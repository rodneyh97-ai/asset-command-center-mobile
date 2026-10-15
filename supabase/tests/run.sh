#!/usr/bin/env bash
# Runs the RLS test suite against a throwaway local PostgreSQL database.
set -euo pipefail
cd "$(dirname "$0")"
DB=eatos_rls_test
pg_ctlcluster 16 main start 2>/dev/null || true
su postgres -c "dropdb --if-exists $DB && createdb $DB"
for f in local_stub.sql ../migrations/0001_init.sql grants.sql rls_test.sql; do
  if ! out=$(su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB -f '$PWD/$f'" 2>&1); then echo "$out"; echo "FAILED in $f"; exit 1; fi
  [ -n "$out" ] && echo "$out"
done
su postgres -c "dropdb $DB"
