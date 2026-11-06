# @resource db
# uses: post_logic
from viat import ctx, ViatError
import post_logic


def main(op: str, post_id: str = "", title: str = "", body: str = ""):
    def check(action, attrs):
        return ctx.authz.check("post", action, attrs)

    try:
        if op == "list":
            # Bounded example: deterministic first 100 published posts, no cache.
            rows = ctx.resources.db.query(
                "SELECT * FROM cms_posts WHERE published_title IS NOT NULL "
                "ORDER BY post_id LIMIT 100")["rows"]
            # Keep object-aware decisions per row: a later owner-dependent rule
            # must take effect without replacing this script with a role shortcut.
            return [post_logic.read(row, check) for row in rows]
        post_logic.identifier(post_id)
        if op not in {"create", "read", "preview", "edit", "publish"}:
            raise ValueError("op must be list/create/read/preview/edit/publish")
        with ctx.resources.db.transaction() as tx:
            if op == "create":
                row = post_logic.create(post_id, title, body,
                                        ctx.principal.identity, check)
                saved = tx.query(
                    "INSERT INTO cms_posts "
                    "(post_id, owner, draft_title, draft_body) "
                    "VALUES (:post_id, :owner, :draft_title, :draft_body) "
                    "ON CONFLICT (post_id) DO NOTHING RETURNING *", row)["rows"]
                if not saved:
                    raise ViatError(409, "conflict", "post_id already exists")
                return {"post_id": post_id, "revision": saved[0]["revision"]}
            lock = "" if op in {"read", "preview"} else " FOR UPDATE"
            rows = tx.query("SELECT * FROM cms_posts WHERE post_id=:post_id" + lock,
                            {"post_id": post_id})["rows"]
            if not rows:
                raise ViatError(404, "not_found", "post not found")
            row = rows[0]
            if op in {"read", "preview"}:
                result = post_logic.read(row, check, preview=op == "preview")
                if result is None:
                    raise ViatError(404, "not_found", "no published version")
                return result
            row = post_logic.change(row, op, title, body, check)
            tx.execute(
                "UPDATE cms_posts SET draft_title=:draft_title, draft_body=:draft_body, "
                "published_title=:published_title, published_body=:published_body, "
                "revision=:revision WHERE post_id=:post_id", row)
            return {"post_id": post_id, "revision": row["revision"]}
    except PermissionError:
        raise ViatError(403, "forbidden", "post action denied") from None
    except ValueError as exc:
        raise ViatError(400, "bad_request", str(exc)) from None
