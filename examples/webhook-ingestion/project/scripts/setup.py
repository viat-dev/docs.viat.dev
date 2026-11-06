# @resource webhook_db
from viat import ctx, ViatError

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS webhook_events (
        event_id TEXT PRIMARY KEY,
        body_sha256 TEXT NOT NULL,
        received_at INTEGER NOT NULL,
        account_id TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 1 AND 1000000)
    )""",
    """CREATE TABLE IF NOT EXISTS webhook_totals (
        account_id TEXT PRIMARY KEY,
        total_cents INTEGER NOT NULL
    )""",
)


def main(confirm: str):
    if confirm != "webhook-ingestion-isolated-db":
        raise ViatError(status=400, code="confirmation_required", message="Use the isolated example database only")
    with ctx.resources.webhook_db.transaction() as tx:
        for sql in SCHEMA:
            tx.execute(sql)
    return {"ready": True, "tables": ["webhook_events", "webhook_totals"]}
