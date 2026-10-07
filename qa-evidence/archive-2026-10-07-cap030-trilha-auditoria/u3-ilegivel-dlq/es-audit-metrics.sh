#!/usr/bin/env bash
# Consulta métricas do serviço audit no Elasticsearch da infra (via docker exec).
# Uso: es-audit-metrics.sh <metric-name> [desde]
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
metric=$1
since=${2:-2026-10-07T18:37:00Z}
es_user="$(grep -m1 '^ELASTIC_USERNAME=' "$root/.env" | cut -d= -f2)"
es_pass="$(grep -m1 '^ELASTIC_PASSWORD=' "$root/.env" | cut -d= -f2)"
body=$(printf '{"size":4,"sort":[{"@timestamp":"asc"}],"_source":["@timestamp","metrics.%s","attributes"],"query":{"bool":{"filter":[{"match_phrase":{"service.name":"CodeForCoders.Audit"}},{"range":{"@timestamp":{"gte":"%s"}}},{"exists":{"field":"metrics.%s"}}]}}}' "$metric" "$since" "$metric")
ssh -o BatchMode=yes desenv-server "docker exec infra-elasticsearch curl -s -u '$es_user:$es_pass' -H 'content-type: application/json' 'localhost:9200/metrics-generic.otel-default/_search' -d '$body'"
