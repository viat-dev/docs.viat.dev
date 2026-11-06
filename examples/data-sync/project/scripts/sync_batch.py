# @resource sync_db
# timeout: 15
from viat import ctx, ViatError

UPSERT = """INSERT INTO sync_items(item_id,value,source_seq,deleted)
    VALUES (:item_id,:value,:seq,:deleted)
    ON CONFLICT(item_id) DO UPDATE SET value=excluded.value,
        source_seq=excluded.source_seq, deleted=excluded.deleted
    WHERE excluded.source_seq > sync_items.source_seq"""


def synchronize(db, batch_size):
    if type(batch_size) is not int or not 1 <= batch_size <= 100:
        raise ViatError(status=400, code="invalid_batch_size", message="batch_size must be an integer from 1 through 100")
    # This deliberately local source adapter is an append-only SQL change log.
    # The write lock serializes concurrent runs before reading their checkpoint.
    with db.transaction() as tx:
        checkpoints = tx.query("SELECT cursor FROM sync_checkpoint WHERE stream='fixture-v1'")["rows"]
        if not checkpoints:
            raise ViatError(status=409, code="checkpoint_missing", message="Run isolated setup first")
        before = checkpoints[0]["cursor"]
        rows = tx.query("""SELECT seq,item_id,value,deleted FROM source_changes
            WHERE seq > :cursor ORDER BY seq LIMIT :limit""",
            {"cursor": before, "limit": batch_size})["rows"]
        cursor = before
        for row in rows:
            tx.execute(UPSERT, row)
            cursor = row["seq"]
        # Never advance past an unapplied change. Any failure rolls back the page.
        tx.execute("UPDATE sync_checkpoint SET cursor=:cursor WHERE stream='fixture-v1'", {"cursor": cursor})
        more = bool(tx.query("SELECT seq FROM source_changes WHERE seq > :cursor LIMIT 1", {"cursor": cursor})["rows"])
    return {"cursor_before": before, "cursor": cursor, "read": len(rows), "more": more}


def main(batch_size: int = 2):
    return synchronize(ctx.resources.sync_db, batch_size)
