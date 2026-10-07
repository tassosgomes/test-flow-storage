# Plano de QA — Trilha de auditoria (CAP-030, fatia mínima)

Sessão `qa-cap030-trilha-auditoria-2026-10-07`. Fonte do comportamento esperado:
`tasks/archive/prd-trilha-auditoria/prd.md` v1.2, `techspec.md` v1.1 (aprovados) e contrato
vigente `contracts/audit/asyncapi.yaml` v1.4.0 (que preserva os compromissos 1.0.1 desta fatia).
Cenários 1–10 do `contracts.md` arquivado mapeados abaixo.

```yaml
id: CT-01
requirement: RF-01.AC1
type: ui+persistence
priority: critical
preconditions: [admin logado no SPA admin, baseline de audit_records capturado]
expected: convite-interno-emitido com motivo via SPA gera Registro conforme com autor, alvo-convite,
  motivo, praticado_em da origem e recebido_em >= praticado_em, no tenant do ato
automation: ephemeral

id: CT-02
requirement: RF-01.AC2
type: ui+persistence
priority: critical
preconditions: [CT-01 publicado, e-mail de convite recebido no smtp4dev]
expected: aceite do convite pelo link gera registro conforme convite-interno-aceito sem motivo
  (aceite não exige motivo)
automation: ephemeral

id: CT-03
requirement: RF-01.AC1
type: ui+persistence
priority: critical
preconditions: [CT-02 concluído, conta de staff ativa]
expected: concessão de papel via SPA gera registro conforme papel-concedido com complemento papel
  e motivo
automation: ephemeral

id: CT-04
requirement: RF-01.AC1
type: ui+persistence
priority: critical
preconditions: [CT-03 concluído]
expected: revogação de papel via SPA gera registro conforme papel-revogado com complemento papel
  e motivo
automation: ephemeral

id: CT-05
requirement: RF-01.AC3
type: persistence
priority: high
preconditions: [CT-01 a CT-04 executados]
expected: nenhuma coluna dos registros E2E contém e-mail ou nome (autor/alvo por referência)
automation: none

id: CT-06
requirement: RF-01 (cenário 1)
type: api+persistence
priority: critical
preconditions: [produtor sintético no exchange audit.events]
expected: ato papel-concedido do exemplo do contrato gera registro conforme com todos os campos
  preservados e recebido_em >= praticado_em
automation: none

id: CT-07
requirement: RF-02.AC2 (cenário 6)
type: api+persistence
priority: high
expected: mesmo conteúdo com fatoId distinto gera dois registros
automation: none

id: CT-08
requirement: RF-02.AC1 (cenário 5a)
type: api+persistence
priority: critical
expected: reentrega idêntica (2 publicações imediatas) mantém um único registro inalterado
automation: none

id: CT-09
requirement: RF-02.AC3 (cenário 5b)
type: api+persistence
priority: critical
expected: reentrega divergente (mesmo fatoId, conteúdo alterado) mantém o original intacto, não
  cria segundo registro e emite sinal de divergência (log/métrica)
automation: none

id: CT-10
requirement: RF-03.AC1
type: api+persistence
priority: critical
expected: papel-revogado sem motivo gera registro não conforme com razão motivo-ausente, demais
  elementos preservados, e alerta (uma vez)
automation: none

id: CT-11
requirement: RF-03.AC2 (cenário 3)
type: api+persistence
priority: high
expected: ato sem autor e sem alvo gera um registro não conforme com as duas razões e um único
  alerta
automation: none

id: CT-12
requirement: RF-03.AC3 (cenário 4)
type: api+persistence
priority: high
expected: tipo desconhecido (papel-alterado) gera registro não conforme com razão
  tipo-desconhecido, tipo informado preservado, e alerta
automation: none

id: CT-13
requirement: RF-03.AC4
type: api+persistence
priority: normal
expected: reentrega do ato não conforme mantém um único registro e não repete alerta
automation: none

id: CT-14
requirement: RF-01.AC4 (cenário 10)
type: api+persistence
priority: high
expected: atos de dois tenants sintéticos distintos geram registros no seu próprio tenant; nenhum
  registro sem tenant
automation: none

id: CT-15
requirement: RF-01.AC3 (cenário 9)
type: api+persistence
priority: high
expected: campo extra com e-mail fora do contrato é descartado; não aparece em nenhuma coluna do
  registro
automation: none

id: CT-16
requirement: RF-03 (TechSpec V-03 momento-ausente)
type: api+persistence
priority: normal
expected: ato legível sem praticadoEm gera registro não conforme com razão momento-ausente
automation: none

id: CT-17
requirement: RF-04 (cenário 7)
type: api
priority: critical
expected: JSON inválido não gera registro; corpo retido na DLQ byte a byte; alerta emitido
automation: none

id: CT-18
requirement: RF-04 (cenário 7)
type: api
priority: critical
expected: mensagem sem fatoId não gera registro; retida intacta na DLQ
automation: none

id: CT-19
requirement: RF-04 (cenário 7)
type: api
priority: high
expected: mensagem sem origem não gera registro; retida intacta na DLQ
automation: none

id: CT-20
requirement: RF-04 (cenário 7, RN-A13)
type: api
priority: critical
expected: mensagem sem tenantId não gera registro; retida intacta na DLQ
automation: none

id: CT-21
requirement: RF-04.AC2
type: api+persistence
priority: high
expected: o mesmo fato do CT-18, republicado legível (com fatoId), registra normalmente
automation: none

id: CT-22
requirement: RF-05.AC1
type: persistence
priority: critical
expected: UPDATE com a credencial de execução é recusado por privilégio; registro idêntico
automation: none

id: CT-23
requirement: RF-05.AC1
type: persistence
priority: critical
expected: DELETE com a credencial de execução é recusado por privilégio; registro idêntico
automation: none

id: CT-24
requirement: RF-05.AC1
type: persistence
priority: high
expected: TRUNCATE com a credencial de execução é recusado por privilégio
automation: none

id: CT-25
requirement: RF-05.AC1
type: persistence
priority: critical
expected: UPDATE e DELETE com a credencial dona são recusados pelo trigger; registro idêntico
automation: none

id: CT-26
requirement: RF-05.AC2
type: persistence
priority: high
expected: login de outro serviço (code_for_coders_identity) não obtém CONNECT no banco do audit
automation: none

id: CT-27
requirement: RF-05.AC3
type: api+persistence
priority: critical
expected: republicação de todas as mensagens da rodada não muda contagem nem conteúdo dos
  registros (cobre reprocessamento sem reiniciar o container no Coolify)
automation: none

id: CT-28
requirement: RF-01.AC5 (cenário 9)
type: api
priority: high
expected: docker logs do audit contém referência aos atos (fatoId/origem/tipo/razões) e nenhuma
  ocorrência dos marcadores de motivo, e-mail ou nome de teste
automation: none

id: CT-29
requirement: RF-01.AC5 (cenário 9)
type: api
priority: normal
expected: Elasticsearch (logs e traces coletados) não contém marcadores de motivo, e-mail ou nome
  de teste
automation: none
```

## Exclusões de escopo

- Consulta da trilha e complemento de registro (segundo PRD de CAP-030) — fora do PRD sob teste.
- Tipos de ato de outros domínios (`versao-publicada`, ofertas, cortesia) — PRDs posteriores.
- Reinício real do container audit no Coolify — coberto por CT-27 (reprocessamento), sem afetar
  a disponibilidade do lab.
- Roteamento de alerta a pessoas (QT-02 da TechSpec, plataforma) — verificamos o sinal emitido.
- Corrida controlada de dois consumidores no fixture (checkpoint de laboratório da TechSpec) —
  CT-08 publica duas entregas imediatas contra 2 consumidores ativos no lab.

## Aprovação

Aprovado pelo usuário em 2026-10-07, incluindo intervenções autorizadas (ver `qa_session.json`).
