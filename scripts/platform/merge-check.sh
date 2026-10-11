#!/usr/bin/env bash
# Applies the credit platform's migrations onto a copy of another database's
# schema, and proves that nothing already there was touched.
#
# Why: the mobile app already has dev, staging and production, the
# entrepreneurs are registered in them, and both schemas key a person to the
# same auth.users row — so the credit platform should move in rather than get
# a project of its own (PLAN.md §1.5). This is how to find out what that
# costs before doing it anywhere real.
#
# It creates and drops one scratch database on the target cluster and changes
# nothing else. The source database is only read.
#
#   CONTAINER=supabase_db_empowerfi-prod bash scripts/platform/merge-check.sh
set -euo pipefail

C=${CONTAINER:-supabase_db_empowerfi-prod}
SRC=${SOURCE_DB:-postgres}
DB=merge_check
MIGRATIONS=platform/supabase/migrations

docker inspect "$C" >/dev/null 2>&1 || { echo "no container $C — is that stack up?"; exit 1; }

echo "copying $SRC's schema from $C"
docker exec "$C" bash -c "pg_dump -U postgres -d $SRC --schema-only > /tmp/merge_base.sql"
docker exec "$C" psql -U postgres -d postgres -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null
docker exec "$C" psql -U postgres -d "$DB" -q -f /tmp/merge_base.sql >/dev/null 2>&1

# Everything the host's objects are, before. Function definitions are hashed
# rather than printed, because what matters is only whether one changed.
Q="select 'col  '||table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'-') from information_schema.columns where table_schema='public'
union all select 'pol  '||tablename||'.'||policyname||':'||coalesce(qual,'-') from pg_policies where schemaname='public'
union all select 'fn   '||p.proname||'('||pg_get_function_identity_arguments(p.oid)||') = '||md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
order by 1"
tmp=$(mktemp -d)
docker exec "$C" psql -U postgres -d "$SRC" -tAc "$Q" > "$tmp/before.txt"
before_tables=$(docker exec "$C" psql -U postgres -d "$SRC" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")

# pg_cron installs only into the database named in cron.database_name, and a
# real Supabase project IS that database. See fresh-install-run.sh.
docker exec -i "$C" psql -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists cron;
create function cron.schedule(text, text, text) returns bigint language sql as $f$ select 1::bigint $f$;
create function cron.unschedule(text) returns boolean language sql as $f$ select true $f$;
create function cron.unschedule(bigint) returns boolean language sql as $f$ select true $f$;
SQL

n=0; failed=0
for f in "$MIGRATIONS"/*.sql; do
  n=$((n + 1))
  out=$(sed 's/^create extension if not exists pg_cron;$/-- [harness] pg_cron: stubbed/' "$f" \
    | docker exec -i "$C" psql -U postgres -d "$DB" -q -1 -v ON_ERROR_STOP=1 2>&1 \
    | grep "^ERROR\|^psql:.*ERROR" || true)
  if [ -n "$out" ]; then
    failed=$((failed + 1))
    printf '\n  FAIL  %s\n%s\n' "$(basename "$f")" "$out"
  fi
done
echo
echo "$n credit migrations onto $SRC's schema, $failed failed"
[ "$failed" -eq 0 ] || { rm -rf "$tmp"; exit 1; }

docker exec "$C" psql -U postgres -d "$DB" -tAc "$Q" > "$tmp/after.txt"
after_tables=$(docker exec "$C" psql -U postgres -d "$DB" -tAc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")
echo "public tables: $before_tables before, $after_tables after"
echo

# Only removals and changes matter. Additions are the credit platform arriving,
# which is the point.
clobbered=$(diff "$tmp/before.txt" "$tmp/after.txt" | grep '^<' || true)
if [ -z "$clobbered" ]; then
  echo "nothing that was already there changed: every column, policy and function"
  echo "definition in $SRC is identical after the migrations."
else
  echo "THESE EXISTED BEFORE AND DO NOT SURVIVE UNCHANGED:"
  echo "$clobbered"
  rm -rf "$tmp"
  docker exec "$C" psql -U postgres -d postgres -q -c "drop database if exists $DB" >/dev/null
  exit 1
fi

docker exec "$C" psql -U postgres -d postgres -q -c "drop database if exists $DB" >/dev/null
rm -rf "$tmp"
