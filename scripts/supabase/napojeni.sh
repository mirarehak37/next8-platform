#!/usr/bin/env bash
# Průvodce napojením CRM na aplikaci (Supabase). Spusťte v terminálu na Macu:
#   bash scripts/supabase/napojeni.sh
# Vygeneruje heslo pro roli crm_reader a CRON_SECRET a postupně je dává do
# schránky (pbcopy). Nic tajného nevypisuje ani neukládá na disk.
set -euo pipefail

REF="iwlfwginwtbutziryekb"
DEFAULT_HOST="aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
DIR="$(cd "$(dirname "$0")" && pwd)"
SQL="$DIR/crm_export.sql"

PASS="$(openssl rand -hex 24)"
SECRET="$(openssl rand -hex 32)"

# Waits for Enter; "c" + Enter puts the step's value on the clipboard again
# (in case something else was copied in the meantime).
step() {
  local value="$1" answer
  printf '%s' "$value" | pbcopy
  while true; do
    read -r -p "  → Až to máš, zmáčkni Enter (c + Enter = zkopírovat znovu)… " answer
    if [[ "$answer" == "c" || "$answer" == "C" ]]; then
      printf '%s' "$value" | pbcopy
      echo "    Zkopírováno znovu."
    else
      break
    fi
  done
  echo
}

echo
echo "1/4  SQL pro Supabase je ve schránce (už s novým heslem)."
echo "     Otevři: https://supabase.com/dashboard/project/$REF/sql/new"
echo "     V editoru Cmd+A, Backspace, Cmd+V a klikni Run. Má skončit hláškou Success."
echo "     Mezi kroky nic jiného nekopíruj (a dotaz v Supabase neukládej)."
step "$(sed "s/password 'ZMENTE_HESLO'/password '$PASS'/" "$SQL")"

echo "2/4  Adresa databáze aplikace (Session pooler):"
echo "     $DEFAULT_HOST"
read -r -p "  → Sedí? Zmáčkni Enter (nebo vlož jiný řetězec / host ze Supabase → Connect): " POOLER
echo
POOLER="${POOLER:-$DEFAULT_HOST}"
HOST="${POOLER#*@}"
HOST="${HOST%%\?*}"
if [[ "$HOST" != *pooler.supabase.com* ]]; then
  echo "Tohle nevypadá jako adresa Session pooleru (…pooler.supabase.com). Spusť průvodce znovu." >&2
  exit 1
fi
[[ "$HOST" == */* ]] || HOST="$HOST/postgres"
[[ "${HOST%%/*}" == *:* ]] || HOST="${HOST%%/*}:5432/${HOST#*/}"
HOST="${HOST/:6543\//:5432/}"
echo "3/4  APP_DB_URL je ve schránce."
echo "     Otevři: https://vercel.com/next8performance-6201/next8-platform/settings/environment-variables"
echo "     Add New → Key: APP_DB_URL, Value: Cmd+V, prostředí Production → Save."
step "postgresql://crm_reader.$REF:$PASS@$HOST"

echo "4/4  CRON_SECRET je ve schránce."
echo "     Ve stejném místě Add New → Key: CRON_SECRET, Value: Cmd+V, Production → Save."
step "$SECRET"

printf '' | pbcopy
unset PASS SECRET POOLER
echo "Hotovo. Schránku jsem vyčistil. Napiš Claudovi „hotovo“ — spustí nové nasazení."
