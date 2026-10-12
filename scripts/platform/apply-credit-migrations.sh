#!/usr/bin/env bash
# Applies the credit platform's migrations to a database the Supabase CLI
# cannot push to, because something else already owns its migration history.
#
# Why this exists: the mobile app and the credit platform now share one
# database, and `supabase_migrations.schema_migrations` is one table. The CLI
# refuses to push from a repository whose migrations directory does not contain
# every version the remote recorded — and --include-all does not bypass it, so
# each side would have to adopt the other's history and become its permanent
# owner. This keeps the two histories apart instead: the app's repo keeps its
# `db push` untouched, and the credit platform records its own versions in
# credit_migrations.schema_migrations.
#
# What is given up: db push, db diff and db pull for this database, on the
# credit side. db push is also what syncs Vault secrets from config.toml, so
# that becomes a separate step.
#
#   DB_URL='postgresql://…' bash scripts/platform/apply-credit-migrations.sh --dry-run
#   DB_URL='postgresql://…' bash scripts/platform/apply-credit-migrations.sh
set -euo pipefail

# Overridable so the script itself can be exercised end to end against a
# scratch database before it is pointed at a real one.
MIGRATIONS=${MIGRATIONS:-platform/supabase/migrations}
DRY=false
[ "${1:-}" = "--dry-run" ] && DRY=true

: "${DB_URL:?set DB_URL to the session-pooler connection string (port 5432, user postgres.<ref>)}"
command -v psql >/dev/null || { echo "psql not found"; exit 1; }

run() { psql "$DB_URL" -v ON_ERROR_STOP=1 -qtA "$@"; }

echo "connecting"
run -c "select 1" >/dev/null

# Its own table, in its own schema, so nothing here is visible to the CLI's
# view of the database and nothing the CLI does is visible to this.
run <<'SQL' >/dev/null
create schema if not exists credit_migrations;
create table if not exists credit_migrations.schema_migrations (
  version     text primary key,
  name        text not null,
  checksum    text not null,
  applied_at  timestamptz not null default now()
);
SQL

applied=$(run -c "select version from credit_migrations.schema_migrations")
pending=(); changed=()

for f in "$MIGRATIONS"/*.sql; do
  base=$(basename "$f")
  version=${base%%_*}
  sum=$(md5sum "$f" | cut -d' ' -f1)
  if grep -qx "$version" <<<"$applied"; then
    # Applied already. If the file has changed since, say so rather than
    # silently running a different schema than the one recorded.
    was=$(run -c "select checksum from credit_migrations.schema_migrations where version = '$version'")
    [ "$was" = "$sum" ] || changed+=("$base")
  else
    pending+=("$f")
  fi
done

if [ ${#changed[@]} -gt 0 ]; then
  echo
  echo "these were applied and have changed on disk since — the database holds the old version:"
  printf '  %s\n' "${changed[@]}"
  echo "fix the file or add a new migration. not applying anything."
  exit 1
fi

echo "${#pending[@]} of $(ls "$MIGRATIONS"/*.sql | wc -l) migrations pending"
[ ${#pending[@]} -eq 0 ] && { echo "nothing to do"; exit 0; }

if $DRY; then
  printf '  would apply  %s\n' "${pending[@]##*/}"
  exit 0
fi

for f in "${pending[@]}"; do
  base=$(basename "$f")
  version=${base%%_*}
  sum=$(md5sum "$f" | cut -d' ' -f1)
  # The migration and its own record, in one transaction: a file that fails
  # leaves no trace, and a file that succeeds cannot go unrecorded.
  #
  # -f and -c rather than concatenating the file with the insert, because a
  # migration need not end in a semicolon -- 20260930000100 ends in $function$
  # and nothing else -- and gluing text after it is a syntax error. psql runs
  # -f and -c in the order given, and -1 wraps both in one transaction.
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -1 \
    -f "$f" \
    -c "insert into credit_migrations.schema_migrations (version, name, checksum) values ('$version', '$base', '$sum')" \
    || { echo "  FAILED  $base"; exit 1; }
  echo "  applied  $base"
done

echo
echo "done. ${#pending[@]} applied."
