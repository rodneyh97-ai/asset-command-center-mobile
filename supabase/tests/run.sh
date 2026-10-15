#!/usr/bin/env bash
# Runs the RLS and library test suites against a throwaway local PostgreSQL database.
set -euo pipefail
cd "$(dirname "$0")"
DB=eatos_rls_test
LIB="$PWD/../../tools/library"
TMP=$(mktemp -d); chmod 755 "$TMP"
trap 'rm -rf "$TMP"' EXIT
pg_ctlcluster 16 main start 2>/dev/null || true
su postgres -c "dropdb --if-exists $DB && createdb $DB"
psql_f() { # file [extra psql args]
  local f=$1; shift
  if ! out=$(su postgres -c "psql -q -v ON_ERROR_STOP=1 -d $DB $* -f '$f'" 2>&1); then echo "$out"; echo "FAILED in $f"; exit 1; fi
  [ -n "$out" ] && echo "$out"
  return 0
}
for f in local_stub.sql ../migrations/0001_init.sql ../migrations/0002_library.sql grants.sql rls_test.sql; do psql_f "$PWD/$f"; done
# Library: import fixtures with the real importers, load twice (must be idempotent), then test.
node -e "
  const [u, o, s] = await Promise.all(['usda','off','osm'].map((m) => import('$LIB/' + m + '.mjs')));
  await u.importUsda('$LIB/fixtures/usda', '$TMP/usda.tsv');
  await o.importOff('$LIB/fixtures/off.tsv', '$TMP/off.tsv');
  await s.importOsm('$LIB/fixtures/overpass.json', '$TMP/places.tsv');
" --input-type=module
cat "$TMP/usda.tsv" "$TMP/off.tsv" > "$TMP/foods.tsv"
chmod 644 "$TMP"/*.tsv
for _ in 1 2; do psql_f "$LIB/load.sql" -v foods="$TMP/foods.tsv" -v places="$TMP/places.tsv"; done
psql_f "$PWD/library_test.sql"
su postgres -c "dropdb $DB"
