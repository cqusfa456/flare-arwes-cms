-- Migration 054: the CMS owns the DNS record for a custom domain
--
-- Attaching a hostname to a Pages project (039) only registers the name: the zone
-- still needs a record pointing at the project, and doing that by hand in the
-- Cloudflare dashboard left half the wiring outside the CMS — a bound domain that
-- stayed `pending` until someone edited DNS elsewhere.
--
-- These columns remember what the CMS found or wrote in the zone, so Admin → Sites
-- can show whether a domain's DNS points at this site and refuse to repoint a name
-- that already serves something else unless the operator asks for it.
--
--   dns_status     'created'     the CMS made the record
--                  'current'     an equivalent record was already there
--                  'updated'     the CMS repointed a record the operator claimed
--                  'conflict'    the name points somewhere else; left untouched
--                  'unsupported' the provider provisions its own record (Workers)
--   dns_target     what the record points at, as Cloudflare reports it
--   dns_record_id  the zone record's id, so the CMS can update or remove its own
--   dns_checked_at when that answer was last read

ALTER TABLE site_domains ADD COLUMN dns_status TEXT;
ALTER TABLE site_domains ADD COLUMN dns_target TEXT;
ALTER TABLE site_domains ADD COLUMN dns_record_id TEXT;
ALTER TABLE site_domains ADD COLUMN dns_checked_at INTEGER;
