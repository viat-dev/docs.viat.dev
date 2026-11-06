"""Offline unit layer only. No Viat runtime, policy engine, database or network."""
import importlib.util
import json
from pathlib import Path
import unittest
import sys

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("post_logic", ROOT / "project/scripts/post_logic.py")
logic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(logic)


class PostLogicTests(unittest.TestCase):
    def test_acceptance_refuses_redirects(self):
        from urllib.request import Request
        spec = importlib.util.spec_from_file_location('cms_acceptance', ROOT / 'acceptance.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        request = Request('https://approved.example.invalid/', headers={'Authorization': 'Bearer fixture'})
        with self.assertRaisesRegex(RuntimeError, 'Redirect refused'):
            module.RejectRedirects().redirect_request(request, None, 302, 'redirect', {}, 'https://other.example.invalid/')


    def test_read_operations_keep_mutation_locks_separate(self):
        import types
        from unittest.mock import patch
        queries = []
        row = logic.create('fixture-post', 'Title', 'Body', 'cms-author-a', lambda *_: True)
        row = logic.change(row, 'publish', '', '', lambda *_: True)

        class Database:
            def transaction(self):
                return self

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def query(self, sql, params=None):
                queries.append(sql)
                return {'rows': [dict(row)]}

            def execute(self, *args):
                return 1

        fake = types.ModuleType('viat')
        fake.ViatError = RuntimeError
        fake.ctx = types.SimpleNamespace(
            resources=types.SimpleNamespace(db=Database()),
            authz=types.SimpleNamespace(check=lambda *_: True),
            principal=types.SimpleNamespace(identity='cms-author-a'))
        with patch.dict(sys.modules, {'viat': fake, 'post_logic': logic}):
            spec = importlib.util.spec_from_file_location('cms_posts', ROOT / 'project/scripts/posts.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            for op in ['read', 'preview', 'publish']:
                module.main(op, post_id='fixture-post')
                self.assertEqual('FOR UPDATE' in queries[-1], op == 'publish')

    def test_publish_is_a_copy_not_a_live_draft(self):
        expected = json.loads((ROOT / "fixtures/expected.json").read_text())
        data = json.loads((ROOT / "fixtures/input.json").read_text())
        allow = lambda action, attrs: True
        post = logic.create(data["post_id"], data["title"], data["body"], "cms-author-a", allow)
        self.assertIsNone(logic.read(post, allow))
        self.assertEqual([], expected["published_before"])
        post = logic.change(post, "publish", "", "", allow)
        self.assertEqual(logic.read(post, allow), expected["published_after"])
        post = logic.change(post, "edit", "Revised draft", "Still private.", allow)
        self.assertEqual(logic.read(post, allow), expected["published_after"])
        self.assertEqual(logic.read(post, allow, preview=True), expected["edited_draft"])
        self.assertEqual(post["owner"], "cms-author-a")

    def test_denied_decisions_are_enforced(self):
        # Stub decisions, NOT an imitation of the Viat policy engine. The live
        # reader/author/editor matrix in README must still be accepted separately.
        post = logic.create("fixture-post", "Draft", "Private", "cms-author-a", lambda *_: True)
        deny = lambda *_: False
        for op in ["edit", "publish"]:
            with self.assertRaises(PermissionError):
                logic.change(post, op, "Forged", "Forged", deny)
        for preview in [True, False]:
            with self.assertRaises(PermissionError):
                logic.read(post, deny, preview=preview)
        with self.assertRaises(PermissionError):
            logic.create("fixture-post", "Draft", "Private", "cms-reader", deny)
        self.assertIsNone(post["published_title"])
        self.assertEqual(post["draft_title"], "Draft")

    def test_checks_use_persisted_owner(self):
        seen = []
        post = logic.create("fixture-post", "Draft", "Private", "cms-author-a", lambda *_: True)
        self.assertEqual(logic.read(post, lambda action, attrs: seen.append((action, attrs)) or True, True)["title"], "Draft")
        self.assertEqual(seen, [("preview", {"owner": "cms-author-a"})])
        with self.assertRaises(PermissionError):
            logic.create("fixture-post", "Draft", "Private", None, lambda *_: True)

    def test_bad_input(self):
        for post_id in ["../x", "x/y", "", "X"]:
            with self.assertRaises(ValueError):
                logic.identifier(post_id)
        for title, body in [("", "body"), ("x" * 161, "body"), ("title", " ")]:
            with self.assertRaises(ValueError):
                logic.content(title, body)

    def test_manifest_and_model_shape(self):
        manifest = json.loads((ROOT / "case.json").read_text())
        self.assertFalse(manifest["external_side_effects_default"])
        # Files use JSON, a YAML subset; no YAML package is needed offline.
        model = json.loads((ROOT / "project/viat.yaml").read_text())
        self.assertEqual({r["name"] for r in model["roles"]}, {"reader", "author", "editor"})
        self.assertTrue(all(not r["is_admin"] for r in model["roles"]))
        publish = [r for r in model["authz"]["rules"] if r["action"] == "publish"]
        self.assertEqual(publish[0]["expr"], {"subj_only": {"subj": "role", "op": "eq", "lit": "editor"}})
        endpoint = json.loads((ROOT / "project/endpoints/default/posts.post.yaml").read_text())
        self.assertEqual(endpoint["target"]["ref"], "posts")
        self.assertNotIn("owner", endpoint["overrides"]["body_fields"])
        self.assertTrue(endpoint["overrides"]["strict"])


if __name__ == "__main__":
    unittest.main()
