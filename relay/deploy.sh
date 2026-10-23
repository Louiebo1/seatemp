#!/bin/bash
# Uploads the relay to Cloudflare (Workers, free plan) as "seatemp" at
# https://seatemp.louiebo.workers.dev. Uses the API token in ~/.config/seatemp/cloudflare-token
# ("Edit Cloudflare Workers" template). Secrets already set are kept.
#   relay/deploy.sh                 upload the code
#   relay/deploy.sh secret NAME     set secret NAME from ~/.config/seatemp/<file> (see below)
set -euo pipefail
cd "$(dirname "$0")/.."
TOKEN=$(tr -d '[:space:]' < ~/.config/seatemp/cloudflare-token)
API=https://api.cloudflare.com/client/v4
auth=(-H "Authorization: Bearer $TOKEN")
ACCOUNT=$(curl -s "${auth[@]}" $API/accounts | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"][0]["id"])')
SCRIPT=seatemp
ok() { python3 -c 'import json,sys; d=json.load(sys.stdin); print("ok" if d.get("success") else "FAILED: %s" % [e.get("message") for e in d.get("errors",[])]); sys.exit(0 if d.get("success") else 1)'; }

if [ "${1:-}" = secret ]; then
  NAME=$2
  case $NAME in
    PASSCODE) FILE=passcode ;;
    AIS_KEY) FILE=ais-key ;;
    GFW_TOKEN) FILE=gfw-token ;;
    RESEND_KEY) FILE=resend-key ;;
    *) echo "unknown secret $NAME"; exit 1 ;;
  esac
  VALUE=$(tr -d '\r\n' < ~/.config/seatemp/$FILE | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  printf '%s' "$VALUE" | python3 -c 'import json,sys; print(json.dumps({"name": sys.argv[1], "text": sys.stdin.read(), "type": "secret_text"}))' "$NAME" \
    | curl -s -X PUT "${auth[@]}" -H "Content-Type: application/json" --data @- "$API/accounts/$ACCOUNT/workers/scripts/$SCRIPT/secrets" | ok
  exit
fi

# First upload creates the Hub's storage (a migration); later ones must not repeat it.
EXISTS=$(curl -s -o /dev/null -w '%{http_code}' "${auth[@]}" "$API/accounts/$ACCOUNT/workers/scripts/$SCRIPT/settings")
METADATA=$(python3 - "$EXISTS" <<'PY'
import json, sys
m = {
  "main_module": "worker.js",
  "compatibility_date": "2025-09-01",
  "bindings": [
    {"type": "durable_object_namespace", "name": "HUB", "class_name": "Hub"},
    {"type": "plain_text", "name": "ALERT_EMAIL", "text": "louiebo@comcast.net"},
  ],
  "keep_bindings": ["secret_text"],
}
if sys.argv[1] != "200":
    m["migrations"] = {"new_tag": "v1", "new_sqlite_classes": ["Hub"]}
print(json.dumps(m))
PY
)
curl -s -X PUT "${auth[@]}" "$API/accounts/$ACCOUNT/workers/scripts/$SCRIPT" \
  -F "metadata=$METADATA;type=application/json" \
  -F "worker.js=@relay/worker.js;type=application/javascript+module" \
  -F "party.js=@js/party.js;type=application/javascript+module" \
  -F "regions-data.js=@js/regions-data.js;type=application/javascript+module" | ok
curl -s -X POST "${auth[@]}" -H "Content-Type: application/json" --data '{"enabled":true,"previews_enabled":false}' \
  "$API/accounts/$ACCOUNT/workers/scripts/$SCRIPT/subdomain" | ok
echo "https://$SCRIPT.louiebo.workers.dev"
