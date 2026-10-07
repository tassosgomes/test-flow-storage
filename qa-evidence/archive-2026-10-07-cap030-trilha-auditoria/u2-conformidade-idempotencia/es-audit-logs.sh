#!/usr/bin/env bash
# Busca texto nos logs do serviço audit no Elasticsearch (data stream logs-generic.otel-default).
# Uso: es-audit-logs.sh <termo> [desde]
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
term=$1
since=${2:-2026-10-07T18:30:00Z}
es_user="$(grep -m1 '^ELASTIC_USERNAME=' "$root/.env" | cut -d= -f2)"
es_pass="$(grep -m1 '^ELASTIC_PASSWORD=' "$root/.env" | cut -d= -f2)"
body=$(printf '{"size":50,"sort":[{"@timestamp":"asc"}],"_source":["@timestamp","severity_number","body.text","attributes"],"query":{"bool":{"filter":[{"match_phrase":{"service.name":"CodeForCoders.Audit"}},{"range":{"@timestamp":{"gte":"%s"}}},{"match_phrase":{"message":"%s"}}]}}}' "$since" "$term")
ssh -o BatchMode=yes desenv-server "docker exec infra-elasticsearch curl -s -u '$es_user:$es_pass' -H 'content-type: application/json' 'localhost:9200/logs-generic.otel-default/_search' -d '$body'"
