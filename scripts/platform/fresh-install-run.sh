#!/usr/bin/env bash
# Applies every migration from zero into a throwaway database and compares the
# result against the one that grew incrementally.
#
# Why: the demo database was built one migration at a time over twenty-five
# days. The production project will apply all of them at once into an empty
# schema, and that is a different code path. PLAN.md calls a fresh-install bug
# the most likely bug in the whole plan. This is how to look for it without
# paying for a project or destroying anything.
#
# It never touches the `postgres` database except to read it. It creates and
# drops `fresh_check` on the local cluster, and nothing else.
#
# The base is a schema-only dump of the local cluster with public and private
# excluded, which is what a new Supabase project looks like: the platform
# schemas present, the product's own schemas empty.
#
#   bash scripts/platform/fresh-install-run.sh
set -euo pipefail

C=${CONTAINER:-supabase_db_empowerfi-platform}
DB=fresh_check
MIGRATIONS=platform/supabase/migrations

docker inspect "$C" >/dev/null 2>&1 || { echo "no container $C — is the local stack up?"; exit 1; }

echo "building the base from $C (platform schemas, no public, no private)"
docker exec "$C" bash -c "pg_dump -U postgres -d postgres --schema-only -N public -N private > /tmp/fresh_base.sql"
docker exec "$C" psql -U postgres -d postgres -q -c "drop database if exists $DB" -c "create database $DB" >/dev/null
docker exec "$C" psql -U postgres -d "$DB" -q -f /tmp/fresh_base.sql >/dev/null 2>&1

# pg_cron will only install into the database named in cron.database_name, and
# a real Supabase project IS that database. The migrations' own
# `create extension if not exists pg_cron` therefore works there and cannot
# here, so the schedule calls get a stand-in and the line is commented out as
# each file goes in. Everything else came through the dump, pg_net included.
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
echo "$n migrations applied from zero, $failed failed"
[ "$failed" -eq 0 ] || exit 1

# Every object the two schemas hold, named and compared. A from-zero run
# should differ from the incremental one only by the migrations the
# incremental one has not applied yet.
Q="select 'table   '||table_schema||'.'||table_name from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE'
union all select 'view    '||table_schema||'.'||table_name from information_schema.views where table_schema in ('public','private')
union all select 'column  '||table_schema||'.'||table_name||'.'||column_name||':'||data_type from information_schema.columns where table_schema in ('public','private')
union all select 'func    '||n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
union all select 'type    '||n.nspname||'.'||t.typname||'='||coalesce((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid),'') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('public','private') and t.typtype='e'
union all select 'policy  '||schemaname||'.'||tablename||'.'||policyname from pg_policies where schemaname in ('public','private')
union all select 'index   '||schemaname||'.'||indexname from pg_indexes where schemaname in ('public','private')
order by 1"

tmp=$(mktemp -d)
for d in postgres "$DB"; do
  docker exec "$C" psql -U postgres -d "$d" -tAc "$Q" | sed 's/[[:space:]]*$//' > "$tmp/$d.txt"
done
echo "incremental: $(wc -l < "$tmp/postgres.txt") objects    from zero: $(wc -l < "$tmp/$DB.txt") objects"
echo
if diff "$tmp/postgres.txt" "$tmp/$DB.txt"; then
  echo "identical."
else
  echo
  echo "Lines marked > exist only in the from-zero schema: expected, if the local"
  echo "database is behind the migration set. Lines marked < exist only in the"
  echo "incremental one, and each is either a manual change or something a"
  echo "from-zero run does not produce. Those are the ones to look at."
fi

docker exec "$C" psql -U postgres -d postgres -q -c "drop database if exists $DB" >/dev/null
rm -rf "$tmp"
echo
echo "What this does not prove: plpgsql bodies are not resolved at creation, so a"
echo "function calling something that does not exist still creates cleanly. And"
echo "it says nothing about data."
