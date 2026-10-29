#!/usr/bin/env bash
# Runs the SQL scenario tests against the linked Supabase project. Each file wraps its work
# in a transaction that is rolled back, so nothing is left behind.
# Needs SUPABASE_DB_PASSWORD (root .env.local) and a linked project (npx supabase link).
# Pass --with <migration.sql> to test a migration before pushing it (applied, then rolled back).
set -euo pipefail
cd "$(dirname "$0")/../.."
if [[ -f .env.local ]]; then set -a; . ./.env.local; set +a; fi

with=""
if [[ "${1:-}" == "--with" ]]; then with="$2"; shift 2; fi

status=0
for test in supabase/tests/*_test.sql; do
  sql=$(mktemp)
  if [[ -n "$with" ]]; then
    # Put the migration inside the test's transaction (right after its "begin;").
    awk -v m="$with" '!done && /^begin;$/ { print; while ((getline line < m) > 0) print line; done=1; next } { print }' "$test" > "$sql"
  else
    cp "$test" "$sql"
  fi
  echo "== $test"
  if out=$(npx supabase db query --linked -f "$sql" --output-format json 2>&1); then
    echo "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const rows=JSON.parse(s).rows;for(const r of rows)console.log("  ok", r.passed);console.log(`  ${rows.length} checks passed`)})'
  else
    echo "$out" | grep -o 'FAILED: [^"\\]*' | head -1 | sed 's/^/  /' || echo "$out" | tail -5
    status=1
  fi
  rm -f "$sql"
done
exit $status
