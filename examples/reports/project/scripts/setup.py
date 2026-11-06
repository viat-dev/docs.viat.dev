# @resource report_db
from viat import ctx, ViatError

SCHEMA = (
    """CREATE TABLE IF NOT EXISTS sales (
        order_id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        currency TEXT NOT NULL CHECK (currency IN ('CNY','USD')),
        amount_cents INTEGER NOT NULL CHECK (amount_cents BETWEEN 0 AND 1000000000)
    )""",
    "CREATE INDEX IF NOT EXISTS sales_window ON sales(occurred_at)",
    """CREATE TABLE IF NOT EXISTS report_runs (
        report_id TEXT PRIMARY KEY,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        report_text TEXT NOT NULL,
        rows_json TEXT NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS report_deliveries (
        report_id TEXT PRIMARY KEY REFERENCES report_runs(report_id),
        state TEXT NOT NULL CHECK (state IN ('sending','accepted','uncertain')),
        attempt_id TEXT NOT NULL,
        accepted INTEGER NOT NULL DEFAULT 0
    )""",
)
SEED = (
    {"id": "fixture-1", "at": "2026-11-03T00:00:00Z", "currency": "USD", "amount": 1250},
    {"id": "fixture-2", "at": "2026-11-03T23:59:59Z", "currency": "USD", "amount": 750},
    {"id": "fixture-3", "at": "2026-11-03T08:00:00Z", "currency": "CNY", "amount": 800},
    {"id": "fixture-outside", "at": "2026-11-04T00:00:00Z", "currency": "USD", "amount": 9999},
)


def main(confirm: str):
    if confirm != "reports-isolated-db":
        raise ViatError(status=400, code="confirmation_required", message="Use the isolated example database only")
    with ctx.resources.report_db.transaction() as tx:
        for sql in SCHEMA:
            tx.execute(sql)
        for row in SEED:
            tx.execute("""INSERT INTO sales(order_id,occurred_at,currency,amount_cents)
                VALUES (:id,:at,:currency,:amount) ON CONFLICT(order_id) DO NOTHING""", row)
    return {"ready": True, "source_rows": 4}
