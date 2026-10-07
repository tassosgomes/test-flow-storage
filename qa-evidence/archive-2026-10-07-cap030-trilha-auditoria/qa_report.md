# Relatório de QA — Trilha de auditoria (CAP-030, fatia mínima)

Sessão `qa-cap030-trilha-auditoria-2026-10-07` · PRD `tasks/archive/prd-trilha-auditoria` v1.2 +
TechSpec v1.1 · Contrato vigente `contracts/audit/asyncapi.yaml` v1.4.0 (compromissos 1.0.1).

## Resultado geral

| Status | Total |
|---|---|
| PASS | 29 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT_EXECUTED | 0 |

**APROVADO** — zero `FAIL`, zero `BLOCKED`.

## Resultado por unidade

### U1 — E2E com produtor real (RF-01) — `u1-e2e-produtor-real/`

Fluxo real: SPA admin → convite com motivo → aceite via link do e-mail (smtp4dev) → concessão e
revogação de papel. Os quatro atos de Identidade nasceram na trilha de ponta a ponta, sem stub.

| Caso | Requisito | Status | Evidência |
|---|---|---|---|
| CT-01 convite-interno-emitido conforme | RF-01.AC1 | PASS | `ct-01-registro.txt`, `ct-01-convite-enviado.png` |
| CT-02 convite-interno-aceito sem motivo é conforme | RF-01.AC2 | PASS | `ct-02-registro.txt`, `ct-02-email-convite.html`, `ct-02-convite-aceito.png` |
| CT-03 papel-concedido com complemento | RF-01.AC1 | PASS | `ct-03-registro.txt` |
| CT-04 papel-revogado | RF-01.AC1 | PASS | `ct-04-registro.txt` |
| CT-05 nenhum e-mail/nome em coluna alguma | RF-01.AC3 | PASS | `ct-05-busca-dado-pessoal.txt` (0 ocorrências) |

Todos com `praticado_em` da origem < `recebido_em` da Auditoria, no tenant do ato, autor/alvo por
referência (`conta-interna`/`convite-interno`).

### U2 — Conformidade e idempotência (RF-01/02/03) — `u2-conformidade-idempotencia/`

| Caso | Requisito | Status | Evidência |
|---|---|---|---|
| CT-06 ato do exemplo do contrato conforme | cenário 1 | PASS | `lote1-registros.txt` |
| CT-07 mesmo conteúdo, `fatoId` distinto → 2 registros | RF-02.AC2 | PASS | `lote1-registros.txt` |
| CT-08 reentrega idêntica (2 publicações) → 1 registro | RF-02.AC1 | PASS | `lote1-registros.txt` |
| CT-09 reentrega divergente: original intacto, 0 novo, alerta | RF-02.AC3 | PASS | `ct-09-original-{antes,depois}.txt` (diff vazio), `ct-09-contagem.txt`, `es-alertas-u2.txt` (warning com as duas impressões digitais) |
| CT-10 papel-revogado sem motivo → `motivo-ausente` + alerta | RF-03.AC1 | PASS | `lote2-registros.txt`, `es-alertas-u2.txt` |
| CT-11 sem autor e sem alvo → 2 razões, 1 alerta | RF-03.AC2 | PASS | `lote2-registros.txt`, `es-alertas-u2.txt` (1 warning `autor-ausente,alvo-ausente`) |
| CT-12 tipo desconhecido preservado + `tipo-desconhecido` | RF-03.AC3 | PASS | `lote2-registros.txt` (`tipo=papel-alterado`) |
| CT-13 reentrega de não conforme → sem novo alerta | RF-03.AC4 | PASS | `ct-13-contagem.txt` (1), `es-alertas-u2.txt` (1 único warning) |
| CT-14 dois tenants sintéticos isolados | RF-01.AC4 | PASS | `lote2-registros.txt` |
| CT-15 campo extra com e-mail descartado | RF-01.AC3 | PASS | `ct-15-campo-extra.txt` (0) |
| CT-16 sem `praticadoEm` → `momento-ausente` | TechSpec V-03 | PASS | `lote2-registros.txt` (`praticado_em` nulo) |

Métricas OTLP observadas no Elasticsearch: `audit.acts.recorded` (com `conformity/origin/type`),
`audit.acts.redelivered{outcome=identical|divergent}`, `audit.acts.nonconforming` — sem `motivo`
nem identificadores de autor/alvo nos atributos.

### U3 — Ilegível retida na DLQ (RF-04) — `u3-ilegivel-dlq/`

| Caso | Requisito | Status | Evidência |
|---|---|---|---|
| CT-17 corpo não-JSON | cenário 7 | PASS | `comparacao-byte-a-byte.txt`, métrica `reason=body` (`es-metrica-ilegiveis.txt`) |
| CT-18 sem `fatoId` | cenário 7 | PASS | idem, `reason=fatoId` |
| CT-19 sem `origem` | cenário 7 | PASS | idem, `reason=origem` |
| CT-20 sem `tenantId` (RN-A13) | cenário 7 | PASS | idem, `reason=tenantId` |
| CT-21 mesmo fato republicado legível registra | RF-04.AC2 | PASS | `ct-21-registro.txt` (conforme) |

0 registros criados para os ilegíveis (`registros-ilegiveis.txt`); as 4 mensagens retidas na DLQ
**byte a byte idênticas** ao publicado, com `x-death reason=rejected`. DLQ purgada ao final da
rodada (voltou a 0), conforme autorizado.

### U4 — Imutabilidade e isolamento (RF-05) — `u4-imutabilidade/`

| Caso | Requisito | Status | Evidência |
|---|---|---|---|
| CT-22 UPDATE com credencial de execução | RF-05.AC1 | PASS | `permission denied for table audit_records` |
| CT-23 DELETE com credencial de execução | RF-05.AC1 | PASS | idem |
| CT-24 TRUNCATE com credencial de execução | RF-05.AC1 | PASS | idem |
| CT-25 UPDATE/DELETE com credencial dona → trigger | RF-05.AC1 | PASS | `ct-25-dona.txt` (`Audit records are append-only`) |
| CT-26 CONNECT de outro serviço negado | RF-05.AC2 | PASS | `ct-26-connect.txt` (`User does not have CONNECT privilege`) |
| CT-27 republicação total → mesma contagem/conteúdo | RF-05.AC3 | PASS | `snapshot-antes.txt` = `snapshot-depois-replay.txt` (35 registros, md5 `43213ab6...`) |

CT-27 republicou as 18 mensagens da rodada (4 E2E reconstruídas dos registros + 13 sintéticas +
republicação legível do CT-21): nenhuma duplicidade, nenhuma alteração.

### U5 — Não-vazamento em telemetria (RF-01.AC5) — `u5-telemetria/`

| Caso | Status | Evidência |
|---|---|---|
| CT-28 console (`docker logs`) sem marcadores | PASS | `audit-console-full.txt`: 0 ocorrências de `QA-CAP030`/`qa.cap030`/`Qa Cap030`; controle positivo com `fatoId`s presente |
| CT-29 Elasticsearch (logs, métricas, traces) sem marcadores | PASS | 0 em `logs-generic`, `metrics-generic` e `traces-generic` para o serviço audit; controles positivos: 2 logs e 135 traces da rodada |

Marcadores usados: textos únicos nos `motivo`s (`QA-CAP030-CT01/03/04/12`), o e-mail convidado
`qa.cap030.convite@example.test`, o nome `Qa Cap030 Suporte` e o e-mail-extra do CT-15.

## Observações e limitações materiais

1. **Perda de linhas no stdout do container `audit` (ambiente, não defeito funcional).** Aprox.
   metade das linhas de log do processamento não aparece em `docker logs` (ex.: 2 dos 4 atos E2E,
   o warning de CT-11 e o de divergência de CT-09). O sink OTLP (Elasticsearch) contém **todos**
   os eventos — inclusive os ausentes no console — e é ele o canal de alerta definido na TechSpec
   ("a aplicação emite em OTLP; coleta e roteamento são da plataforma"). A verificação de alertas
   da rodada usou o Elasticsearch por essa razão. Recomenda-se à plataforma investigar a perda no
   stdout; não afecta os critérios do PRD.
2. **Reprocessamento sem reinício (CT-27).** O container não foi reiniciado no Coolify (limitação
   declarada no plano); a republicação total das mensagens da rodada cobre o mesmo gate da TechSpec
   ("republicar todas as mensagens anteriores → mesma contagem").
3. **Métricas cumulativas.** Os contadores OTLP reexportam pontos periodicamente; a unicidade de
   alerta por ato (RF-03) foi verificada pelos logs estruturados (exatamente 1 warning por ato).
4. **Roteamento de alerta a pessoas (QT-02 da TechSpec)** permanece pendência de plataforma — fora
   do escopo, como no plano.
5. **Resíduos autorizados:** conta de staff `qa.cap030.convite@example.test` (papel suporte) no
   tenant do lab; registros de auditoria da rodada (imutáveis por natureza, incluindo os tenants
   sintéticos T_A/T_B); DLQ devolvida a 0.

## Escopo excluído (conforme plano)

- Consulta da trilha e complemento de registro (segundo PRD de CAP-030).
- Tipos de ato de outros domínios (`versao-publicada`, ofertas, cortesia).
- Reinício real do container `audit` no Coolify.
- Corrida controlada de dois consumidores em fixture (coberta parcialmente por CT-08 contra os
  2 consumidores ativos do lab).

## Candidatos à automação persistente

Nenhum promovido. A suíte estabelecida do serviço (`src/audit/tests`, Testcontainers) já cobre
V-01 a V-05 com os mesmos cenários; a rodada não revelou regressão nem fronteira nova que justi
fique caso persistente adicional. Os artefatos efêmeros (scripts de publicação/consulta, payloads,
helpers ES) ficam em `qa-evidence/u*/` para reprodução.
