"""OPT-IN HTTP/DB acceptance for a NEW isolated CMS project, not validate.py.
Leaves fixture-post and the prepared seed-post for deliberate cleanup.
"""
import argparse
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, Request, build_opener


class RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # urllib otherwise forwards Authorization across redirected origins.
        raise RuntimeError("Redirect refused; use the final approved endpoint URL")


def run(url, keys):
    opener = build_opener(RejectRedirects())
    def call(who, data, expected=200):
        headers = {"Content-Type": "application/json"}
        if who:
            headers["Authorization"] = "Bearer " + keys[who]
        request = Request(url, json.dumps(data).encode(), headers, method="POST")
        try:
            with opener.open(request, timeout=30) as response:
                status, value = response.status, json.load(response)
        except HTTPError as response:
            status, value = response.code, json.load(response)
        if status != expected:
            raise AssertionError(f"{who or 'anonymous'} {data['op']}: expected {expected}, got {status}")
        return value

    root = Path(__file__).resolve().parent
    fixture = json.loads((root / "fixtures/input.json").read_text())
    expected = json.loads((root / "fixtures/expected.json").read_text())
    post_id = fixture["post_id"]
    assert call("reader", {"op": "list"}) == []
    call(None, {"op": "list"}, 401)
    call("reader", fixture, 403)
    call("author", fixture)
    call("reader", {"op": "read", "post_id": post_id}, 404)
    for who, op in [("reader", "preview"), ("reader", "edit"),
                    ("reader", "publish"), ("other", "preview"),
                    ("other", "edit"), ("author", "publish")]:
        call(who, {"op": op, "post_id": post_id, "title": "Forbidden", "body": "Forbidden"}, 403)
    call("author", dict(fixture, post_id="forged-post", owner="cms-editor"), 400)
    call("author", {"op": "edit", "post_id": post_id, "title": "Forged", "body": "Forged", "role": "editor"}, 400)
    call("editor", {"op": "publish", "post_id": post_id})
    assert call("reader", {"op": "read", "post_id": post_id}) == expected["published_after"]
    call("author", {"op": "edit", "post_id": post_id, "title": "Revised draft", "body": "Still private."})
    assert call("reader", {"op": "read", "post_id": post_id}) == expected["published_after"]
    assert call("editor", {"op": "preview", "post_id": post_id}) == expected["edited_draft"]
    call("author", fixture, 409)
    print("CMS HTTP assertions passed; recorded business IDs: fixture-post, seed-post. No cleanup performed.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="published /p/<isolated-slug>/posts URL")
    for role in ["reader", "author", "other", "editor"]:
        parser.add_argument("--" + role + "-key-file", required=True)
    parser.add_argument("--allow-remote-writes", action="store_true", required=True)
    args = parser.parse_args()
    keys = {role: Path(getattr(args, role + "_key_file")).read_text().strip()
            for role in ["reader", "author", "other", "editor"]}
    run(args.url, keys)
