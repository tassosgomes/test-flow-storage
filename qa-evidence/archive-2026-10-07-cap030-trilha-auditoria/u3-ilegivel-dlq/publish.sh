#!/usr/bin/env bash
# Publica um payload JSON no exchange audit.events com routing key do ato praticado.
# Uso: publish.sh <arquivo-payload> <correlation-id>
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
payload_file=$1
correlation=$2
rabbit_pass="$(grep -m1 '^REMOTE_RABBITMQ_PASSWORD=' "$root/.env" | cut -d= -f2)"
python_payload=$(jq -Rs . < "$payload_file")
curl -s -u "code_for_coders:$rabbit_pass" \
  -H 'content-type: application/json' \
  -X POST "http://192.168.0.5:15672/api/exchanges/code-for-coders/audit.events/publish" \
  -d "{\"properties\":{\"content_type\":\"application/json\",\"headers\":{\"correlationId\":\"$correlation\"}},\"routing_key\":\"auditoria.ato-praticado.v1\",\"payload\":$python_payload,\"payload_encoding\":\"string\"}"
echo
