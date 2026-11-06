# @resource sync_db
from viat import ctx, ViatError

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS source_changes (
        seq INTEGER PRIMARY KEY CHECK (seq > 0),
        item_id TEXT NOT NULL,
        value TEXT NOT NULL,
        deleted INTEGER NOT NULL CHECK (deleted IN (0,1))
    )""",
    """CREATE TABLE IF NOT EXISTS sync_items (
        item_id TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        source_seq INTEGER NOT NULL,
        deleted INTEGER NOT NULL CHECK (deleted IN (0,1))
    )""",
    """CREATE TABLE IF NOT EXISTS sync_checkpoint (
        stream TEXT PRIMARY KEY CHECK (stream='fixture-v1'),
        cursor INTEGER NOT NULL CHECK (cursor >= 0)
    )""",
)
SEED = (
    {"seq": 1, "item_id": "A", "value": "alpha", "deleted": 0},
    {"seq": 2, "item_id": "B", "value": "beta", "deleted": 0},
    {"seq": 3, "item_id": "A", "value": "alpha-v2", "deleted": 0},
    {"seq": 4, "item_id": "B", "value": "", "deleted": 1},
)


def main(confirm: str):
    if confirm != "data-sync-isolated-db":
        raise ViatError(status=400, code="confirmation_required", message="Use the isolated example database only")
    with ctx.resources.sync_db.transaction() as tx:
        for sql in SCHEMA:
            tx.execute(sql)
        tx.execute("INSERT INTO sync_checkpoint(stream,cursor) VALUES ('fixture-v1',0) ON CONFLICT(stream) DO NOTHING")
        for row in SEED:
            tx.execute("""INSERT INTO source_changes(seq,item_id,value,deleted)
                VALUES (:seq,:item_id,:value,:deleted) ON CONFLICT(seq) DO NOTHING""", row)
    return {"ready": True, "source_rows": 4}
