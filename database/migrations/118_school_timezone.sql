-- "Today" is the school's day (docs/ASSUMPTIONS.md: Asia/Kolkata). A server running in
-- UTC would put 00:00-05:30 IST on the previous day for current_date and date casts.
-- The API also sets the zone on each connection; this role default covers connections
-- that bypass that (psql, other tools). A server that refuses it must not block migrations.
DO $$
BEGIN
  EXECUTE format('ALTER ROLE %I SET timezone = %L', current_user, 'Asia/Kolkata');
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not set the default time zone for role %; the API sets it per connection', current_user;
END $$;
