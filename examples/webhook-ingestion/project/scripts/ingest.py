# @resource webhook_db
# @resource webhook_key
# timeout: 15
import base64
import hashlib
import json
import re
import time
from viat import ctx, ViatError

MAX_BYTES = 65536
WINDOW_SECONDS = 300
IDENTIFIER = re.compile(r"[A-Za-z0-9_-]{1,64}\Z")


def refuse(status, code, message):
    raise ViatError(status=status, code=code, message=message)


def process(db, key, raw, headers, now):
    """Only the ledger and local projection share a transaction; no external send."""
    if not isinstance(raw, bytes) or len(raw) > MAX_BYTES:
        refuse(413, "event_too_large", "Event body exceeds 65536 bytes")
    stamp = headers.get("x-event-timestamp", "")
    signature = headers.get("x-event-signature", "")
    if not re.fullmatch(r"[0-9]{10}", stamp) or not re.fullmatch(r"[0-9a-f]{64}", signature):
        refuse(401, "invalid_signature", "Expected Unix seconds and lowercase hex HMAC-SHA256")
    if abs(now - int(stamp)) > WINDOW_SECONDS:
        refuse(401, "stale_event", "Timestamp is outside the 300-second acceptance window")
    # Verifying the exact bytes avoids JSON reserialization changing the signed message.
    if not key.verify(stamp.encode("ascii") + b"." + raw, signature,
                      signature_encoding="hex", hash="sha256"):
        refuse(401, "invalid_signature", "Signature did not verify")
    try:
        event = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeError):
        refuse(400, "invalid_event", "Expected UTF-8 JSON object")
    if not isinstance(event, dict) or set(event) != {"event_id", "account_id", "amount_cents"}:
        refuse(400, "invalid_event", "Expected event_id, account_id and amount_cents only")
    for name in ("event_id", "account_id"):
        if not isinstance(event[name], str) or not IDENTIFIER.fullmatch(event[name]):
            refuse(400, "invalid_event", "Identifiers must be 1-64 ASCII letters, digits, underscore or hyphen")
    amount = event["amount_cents"]
    if type(amount) is not int or not 1 <= amount <= 1000000:
        refuse(400, "invalid_event", "amount_cents must be an integer from 1 through 1000000")
    digest = hashlib.sha256(raw).hexdigest()
    params = {**event, "digest": digest, "received": int(now)}
    # SQLite BEGIN IMMEDIATE serializes competing writers before the lookup.
    # Return success only after __exit__ has acknowledged the commit.
    duplicate = False
    with db.transaction() as tx:
        previous = tx.query("SELECT body_sha256 FROM webhook_events WHERE event_id=:event_id", params)["rows"]
        if previous:
            if previous[0]["body_sha256"] != digest:
                refuse(409, "event_conflict", "event_id was already used with different bytes")
            duplicate = True
        else:
            tx.execute("""INSERT INTO webhook_events
                (event_id,body_sha256,received_at,account_id,amount_cents)
                VALUES (:event_id,:digest,:received,:account_id,:amount_cents)""", params)
            tx.execute("""INSERT INTO webhook_totals(account_id,total_cents)
                VALUES (:account_id,:amount_cents)
                ON CONFLICT(account_id) DO UPDATE SET
                total_cents=webhook_totals.total_cents+excluded.total_cents""", params)
    return {"event_id": event["event_id"], "status": "duplicate" if duplicate else "processed"}


def main():
    if ctx.request.body is not None:
        raw = ctx.request.body.encode("utf-8")
    elif ctx.request.body_base64 is not None:
        raw = base64.b64decode(ctx.request.body_base64, validate=True)
    else:
        refuse(400, "raw_body_required", "Use the configured raw-body HTTP endpoint")
    return process(ctx.resources.webhook_db, ctx.resources.webhook_key, raw,
                   ctx.request.headers, int(time.time()))
