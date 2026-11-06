-- Run as the owner of a NEW lab_jobs_example business database, never Viat's DB.
BEGIN;
CREATE TABLE lab_jobs (
    job_id text PRIMARY KEY,
    payload text NOT NULL,
    state text NOT NULL DEFAULT 'prepared'
      CHECK (state IN ('prepared','queued','running','succeeded','failed','cancelled')),
    event_seq bigint NOT NULL DEFAULT -1,
    cancel_requested boolean NOT NULL DEFAULT false
);
GRANT CONNECT ON DATABASE lab_jobs_example TO lab_jobs_example;
GRANT USAGE ON SCHEMA public TO lab_jobs_example;
GRANT SELECT, INSERT, UPDATE ON lab_jobs TO lab_jobs_example;
COMMIT;
-- No fake 'submitted' rows are seeded: the first opt-in submission creates one.
