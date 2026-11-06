# @resource db
# @resource adapter
# uses: job_logic
from viat import ctx, ViatError
import job_logic


def load(tx, job_id, *, for_update=True):
    lock = " FOR UPDATE" if for_update else ""
    rows = tx.query("SELECT * FROM lab_jobs WHERE job_id=:job_id" + lock,
                    {"job_id": job_id})["rows"]
    if not rows:
        raise ViatError(404, "not_found", "unknown job_id")
    return rows[0]


def apply_event(job_id, event):
    with ctx.resources.db.transaction() as tx:
        row = load(tx, job_id)
        updated, decision = job_logic.reduce_event(row, event)
        if decision == "applied":
            tx.execute("UPDATE lab_jobs SET state=:state, event_seq=:event_seq "
                       "WHERE job_id=:job_id", updated)
        return dict(job_logic.public(updated), decision=decision)


def main(op: str, job_id: str, payload: dict = None, event: dict = None,
         opt_in: bool = False):
    try:
        job_logic.identifier(job_id)
        if op not in {"submit", "read", "poll", "event", "cancel"}:
            raise ValueError("op must be submit/read/poll/event/cancel")
        ctx.authz.require("job", op, {})
        if op in {"submit", "poll", "cancel"} and opt_in is not True:
            # A disabled schedule is one guard; this independent guard also
            # prevents a manual/default call from sending anything externally.
            return {"dry_run": True, "job_id": job_id, "op": op}
        if op == "event":
            return apply_event(job_id, event)
        if op == "submit":
            encoded = job_logic.canonical(payload)
            with ctx.resources.db.transaction() as tx:
                tx.execute("INSERT INTO lab_jobs(job_id, payload) VALUES (:job_id, :payload) "
                           "ON CONFLICT (job_id) DO NOTHING",
                           {"job_id": job_id, "payload": encoded})
                row = load(tx, job_id)
                job_logic.same_submission(row, payload)
            # The record commits BEFORE sending. Adapter POST must be durably
            # idempotent by job_id; a timeout/restart is reconciled by resending
            # the same job_id/payload or polling, never by inventing a new ID.
            if row["state"] != "prepared":
                return job_logic.public(row)
            reply = ctx.resources.adapter.post("/jobs", json={"job_id": job_id, "payload": payload})
            return apply_event(job_id, reply)
        if op == "read":
            with ctx.resources.db.transaction() as tx:
                return job_logic.public(load(tx, job_id, for_update=False))
        if op == "cancel":
            with ctx.resources.db.transaction() as tx:
                row = load(tx, job_id)
                if row["state"] in job_logic.TERMINAL:
                    return dict(job_logic.public(row), decision="terminal")
                if row["state"] == "prepared":
                    # An uncertain POST may already be accepted. Reconcile it
                    # first; cancelling an unknown provider ID proves nothing.
                    raise ViatError(409, "conflict", "reconcile submission by resending same job_id first")
                tx.execute("UPDATE lab_jobs SET cancel_requested=true WHERE job_id=:job_id",
                           {"job_id": job_id})
            # A request is not a confirmed cancellation. Only the returned or
            # subsequent authenticated event may change the durable state.
            reply = ctx.resources.adapter.post("/jobs/" + job_id + "/cancel", json={})
            return apply_event(job_id, reply)
        with ctx.resources.db.transaction() as tx:
            load(tx, job_id, for_update=False)
        reply = ctx.resources.adapter.get("/jobs/" + job_id)
        return apply_event(job_id, reply)
    except ValueError as exc:
        raise ViatError(400, "bad_request", str(exc)) from None
