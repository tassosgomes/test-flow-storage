#!/usr/bin/env bash
# Conta documentos com os marcadores de dado pessoal da rodada nos data streams
# logs/metrics/traces do serviço audit no Elasticsearch da infra.
set -Eeuo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
es_user="$(grep -m1 '^ELASTIC_USERNAME=' "$root/.env" | cut -d= -f2)"
es_pass="$(grep -m1 '^ELASTIC_PASSWORD=' "$root/.env" | cut -d= -f2)"
marker=$1
stream=$2
svc=${3:-CodeForCoders.Audit}
body=$(printf '{"size":3,"query":{"bool":{"filter":[{"match_phrase":{"service.name":"%s"}}],"should":[{"match_phrase":{"message":"%s"}},{"match_phrase":{"body.text":"%s"}},{"query_string":{"query":"attributes:*%%22%s%%22 OR metrics:*%%22%s%%22"}}],"minimum_should_match":1}}}' "$svc" "$marker" "$marker" "$marker" "$marker")
ssh -o BatchMode=yes desenv-server "docker exec infra-elasticsearch curl -s -u '$es_user:$es_pass' -H 'content-type: application/json' 'localhost:9200/$stream/_search' -d '$body'"
