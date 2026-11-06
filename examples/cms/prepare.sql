-- Run as the owner of a NEW cms_example business database, never Viat's DB.
BEGIN;
CREATE TABLE cms_posts (
    post_id text PRIMARY KEY,
    owner text NOT NULL,
    draft_title text NOT NULL CHECK (length(draft_title) BETWEEN 1 AND 160),
    draft_body text NOT NULL CHECK (length(draft_body) BETWEEN 1 AND 20000),
    published_title text,
    published_body text,
    revision integer NOT NULL DEFAULT 1,
    CHECK ((published_title IS NULL) = (published_body IS NULL))
);
INSERT INTO cms_posts(post_id, owner, draft_title, draft_body)
VALUES ('seed-post', 'cms-author-a', 'Synthetic seed draft', 'Never public until editor publish.');
GRANT CONNECT ON DATABASE cms_example TO cms_example;
GRANT USAGE ON SCHEMA public TO cms_example;
GRANT SELECT, INSERT, UPDATE ON cms_posts TO cms_example;
COMMIT;
