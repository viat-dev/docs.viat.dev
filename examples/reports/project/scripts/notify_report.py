# @resource report_db
# @resource report_mail
# timeout: 15
import uuid
from viat import ctx, ViatError

RECIPIENT = "reports@example.test"


def deliver(db, mail, report_id, send):
    if type(send) is not bool:
        raise ViatError(status=400, code="invalid_send", message="send must be a boolean")
    if not isinstance(report_id, str) or not 1 <= len(report_id) <= 80:
        raise ViatError(status=400, code="invalid_report_id", message="Use the report_id returned by build_report")
    attempt = str(uuid.uuid4())
    params = {"id": report_id, "attempt": attempt}
    with db.transaction() as tx:
        saved = tx.query("SELECT report_text FROM report_runs WHERE report_id=:id", params)["rows"]
        if not saved:
            raise ViatError(status=404, code="report_missing", message="Build the report first")
        if not send:
            return {"state": "disabled", "attempted": False}
        previous = tx.query("SELECT state FROM report_deliveries WHERE report_id=:id", params)["rows"]
        if previous:
            return {"state": previous[0]["state"], "attempted": False}
        # Commit a durable claim BEFORE sending. Never hold a DB lock during SMTP.
        tx.execute("INSERT INTO report_deliveries(report_id,state,attempt_id) VALUES (:id,'sending',:attempt)", params)
    try:
        response = mail.send(to=RECIPIENT, subject="Sales report " + report_id, text=saved[0]["report_text"])
        if not isinstance(response, dict) or response.get("queued") is not True or response.get("accepted", 0) < 1:
            raise RuntimeError("relay did not confirm acceptance")
    except Exception:
        db.execute("""UPDATE report_deliveries SET state='uncertain'
            WHERE report_id=:id AND attempt_id=:attempt AND state='sending'""", params)
        raise ViatError(status=502, code="delivery_uncertain", message="Inspect relay evidence before authorizing another attempt")
    # If this acknowledgement fails, the durable state stays sending. Automatic
    # replay must not submit a second message after an uncertain first outcome.
    db.execute("""UPDATE report_deliveries SET state='accepted',accepted=:accepted
        WHERE report_id=:id AND attempt_id=:attempt AND state='sending'""",
        {**params, "accepted": response["accepted"]})
    return {"state": "accepted", "attempted": True, "accepted": response["accepted"]}


def main(report_id: str, send: bool = False):
    return deliver(ctx.resources.report_db, ctx.resources.report_mail, report_id, send)
