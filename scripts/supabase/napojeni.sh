#!/usr/bin/env bash
# Průvodce napojením CRM na aplikaci (Supabase). Spusťte v terminálu na Macu:
#   bash scripts/supabase/napojeni.sh
# Vygeneruje heslo pro roli crm_reader a CRON_SECRET a postupně je dává do
# schránky (pbcopy). Nic tajného nevypisuje ani neukládá na disk.
set -euo pipefail

REF="iwlfwginwtbutziryekb"
DIR="$(cd "$(dirname "$0")" && pwd)"
SQL="$DIR/crm_export.sql"

PASS="$(openssl rand -hex 24)"
SECRET="$(openssl rand -hex 32)"

pause() { read -r -p "  → Až to máš, zmáčkni Enter… " _; echo; }

echo
echo "1/4  SQL pro Supabase je ve schránce (už s novým heslem)."
sed "s/password 'ZMENTE_HESLO'/password '$PASS'/" "$SQL" | pbcopy
echo "     Otevři: https://supabase.com/dashboard/project/$REF/sql/new"
echo "     Vlož (Cmd+V) a klikni Run. Má skončit hláškou Success."
pause

echo "2/4  V Supabase otevři: https://supabase.com/dashboard/project/$REF?showConnect=true"
echo "     Vyber „Session pooler“ (Method: Session pooler) a zkopíruj připojovací řetězec (URI)."
read -r -p "  → Vlož ho sem a zmáčkni Enter: " POOLER
echo
HOST="${POOLER#*@}"
if [[ "$HOST" == "$POOLER" || "$HOST" != *pooler.supabase.com* ]]; then
  echo "Tohle nevypadá jako řetězec Session pooleru (…@aws-…pooler.supabase.com:5432/postgres). Spusť průvodce znovu." >&2
  exit 1
fi
HOST="${HOST/:6543\//:5432/}"
printf '%s' "postgresql://crm_reader.$REF:$PASS@$HOST" | pbcopy
echo "3/4  APP_DB_URL je ve schránce."
echo "     Otevři: https://vercel.com/next8performance-6201/next8-platform/settings/environment-variables"
echo "     Add New → Key: APP_DB_URL, Value: Cmd+V, prostředí Production → Save."
pause

printf '%s' "$SECRET" | pbcopy
echo "4/4  CRON_SECRET je ve schránce."
echo "     Ve stejném místě Add New → Key: CRON_SECRET, Value: Cmd+V, Production → Save."
pause

printf '' | pbcopy
unset PASS SECRET POOLER
echo "Hotovo. Schránku jsem vyčistil. Napiš Claudovi „hotovo“ — spustí nové nasazení."
