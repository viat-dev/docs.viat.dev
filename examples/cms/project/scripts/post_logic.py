"""Pure application logic shared by the deployed API and offline unit checks."""
import re


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", value):
        raise ValueError("post_id must be a lowercase slug, 1..64 characters")
    return value


def content(title, body):
    if not isinstance(title, str) or not title.strip() or len(title) > 160:
        raise ValueError("title must contain 1..160 characters")
    if not isinstance(body, str) or not body.strip() or len(body) > 20000:
        raise ValueError("body must contain 1..20000 characters")
    return title, body


def require(check, action, row):
    # Only persisted ownership is used; the HTTP caller never supplies this fact.
    if not check(action, {"owner": row["owner"]}):
        raise PermissionError(action)


def create(post_id, title, body, identity, check):
    identifier(post_id)
    content(title, body)
    if not identity:
        raise PermissionError("an authenticated identity is required")
    row = {"post_id": post_id, "owner": identity, "draft_title": title,
           "draft_body": body, "published_title": None, "published_body": None,
           "revision": 1}
    require(check, "create", row)
    return row


def read(row, check, preview=False):
    require(check, "preview" if preview else "read", row)
    prefix = "draft" if preview else "published"
    if row[prefix + "_title"] is None:
        return None
    return {"post_id": row["post_id"], "title": row[prefix + "_title"],
            "body": row[prefix + "_body"]}


def change(row, op, title, body, check):
    require(check, "publish" if op == "publish" else "update", row)
    updated = dict(row)
    if op == "edit":
        content(title, body)
        updated.update(draft_title=title, draft_body=body)
    elif op == "publish":
        updated.update(published_title=row["draft_title"],
                       published_body=row["draft_body"])
    else:
        raise ValueError("unsupported mutation")
    updated["revision"] += 1
    return updated
