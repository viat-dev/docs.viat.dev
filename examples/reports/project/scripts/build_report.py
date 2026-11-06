# @resource report_db
# timeout: 15
from datetime import date, datetime, timedelta, timezone
import json
from viat import ctx, ViatError

REPORT_VERSION = "daily-v1"
MAX_ROWS = 10000
MAX_TEXT_BYTES = 65536


def build(db, start_date, end_date):
    try:
        start, end = date.fromisoformat(start_date), date.fromisoformat(end_date)
        if start.isoformat() != start_date or end.isoformat() != end_date or not 1 <= (end - start).days <= 31:
            raise ValueError("window")
    except (ValueError, TypeError):
        raise ViatError(status=400, code="invalid_window", message="Use canonical YYYY-MM-DD dates with a 1-31 day [start,end) window")
    report_id = REPORT_VERSION + ":" + start_date + ":" + end_date
    params = {"id": report_id, "start": start_date, "end": end_date,
              "lo": start_date + "T00:00:00Z", "hi": end_date + "T00:00:00Z"}
    with db.transaction() as tx:
        saved = tx.query("SELECT report_text,rows_json FROM report_runs WHERE report_id=:id", params)["rows"]
        if saved:
            text, rows = saved[0]["report_text"], json.loads(saved[0]["rows_json"])
        else:
            count = tx.query("SELECT COUNT(*) AS n FROM sales WHERE occurred_at >= :lo AND occurred_at < :hi", params)["rows"][0]["n"]
            if count > MAX_ROWS:
                raise ViatError(status=413, code="report_row_limit", message="Window exceeds 10000 sales; split the window")
            rows = tx.query("""SELECT currency,COUNT(*) AS orders,SUM(amount_cents) AS total_cents
                FROM sales WHERE occurred_at >= :lo AND occurred_at < :hi
                GROUP BY currency ORDER BY currency""", params)["rows"]
            lines = ["Daily sales (UTC) [" + start_date + ", " + end_date + ")"]
            lines += [f"{row['currency']} orders={row['orders']} total_cents={row['total_cents']}" for row in rows]
            if not rows:
                lines.append("No sales")
            text = "\n".join(lines) + "\n"
            if len(text.encode("utf-8")) > MAX_TEXT_BYTES:
                raise ViatError(status=413, code="report_size_limit", message="Report exceeds 65536 UTF-8 bytes")
            tx.execute("""INSERT INTO report_runs(report_id,start_date,end_date,report_text,rows_json)
                VALUES (:id,:start,:end,:text,:rows)""",
                {**params, "text": text, "rows": json.dumps(rows, sort_keys=True)})
    return {"report_id": report_id, "text": text, "rows": rows}


def main(start_date: str = "", end_date: str = ""):
    if start_date == "" and end_date == "":
        end = datetime.now(timezone.utc).date()
        start_date, end_date = (end - timedelta(days=1)).isoformat(), end.isoformat()
    return build(ctx.resources.report_db, start_date, end_date)
