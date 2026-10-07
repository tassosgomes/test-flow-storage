# QA Test Plan — CAP-001 Conta e autenticação do aluno

- **Rodada:** qa-cap001-conta-aluno-2026-10-07
- **Fonte dos requisitos:** `tasks/archive/prd-conta-aluno/prd.md` v1.1 (RF-01 a RF-06), `techspec.md`, `domains/identidade-e-acesso/domain.md` (RN-01 a RN-11, RN-13, RN-21 a RN-28), DP-01 a DP-06.
- **Status:** Aprovado pelo usuário em 2026-10-07 (execução completa, incluindo arranjos de DB em dados da própria rodada).
- **Ambiente:** SPA do aluno `https://c4c-student.lab.tasso.dev.br/student`; BFF `/api/v1` (mesma origem); e-mails capturados no smtp4dev (`https://smtp.tasso.dev.br`, basic auth via `SMTP4DEV_USERNAME`/`SMTP4DEV_PASSWORD`); persistência consultada por psql (`REMOTE_DB_PASSWORD`). Validade de links: 1 h.
- **Automação:** UI por browser Playwright interativo (screenshots em cada unidade); API por curl; persistência por psql. Evidências com `case_id` no nome.

## U1 — Cadastro e confirmação (RF-01, RF-02)

```yaml
- id: CT-01
  requirement: RF-01.AC-01
  type: ui
  priority: critical
  preconditions: [e-mail sem conta]
  expected: cadastro válido cria Conta não confirmada + 1 pedido de confirmação; UI orienta verificar e-mail; link chega ao smtp4dev
  automation: ephemeral
- id: CT-02
  requirement: RF-01.AC-02
  type: api
  priority: critical
  preconditions: [conta CT-01 existente]
  expected: novo cadastro com o mesmo e-mail devolve ACCOUNT_ALREADY_EXISTS e não cria conta nem credencial
  automation: ephemeral
- id: CT-03
  requirement: RF-01.AC-03
  type: api
  priority: high
  preconditions: [conta CT-01 existente]
  expected: e-mail com maiúsculas/espaços nas bordas corresponde à mesma identidade normalizada (recusa como duplicado)
  automation: ephemeral
- id: CT-04
  requirement: [RF-01.AC-04, RF-03.AC-03]
  type: ui
  priority: critical
  preconditions: [conta não confirmada]
  expected: login com senha correta é negado com orientação de confirmar e-mail; senha incorreta recebe resposta genérica
  automation: ephemeral
- id: CT-05
  requirement: RF-01.AC-05 (DP-05)
  type: api
  priority: high
  preconditions: []
  expected: senha com <8 chars, sem classe exigida ou espaço como símbolo é recusada e nenhuma Conta é criada
  automation: ephemeral
- id: CT-06
  requirement: RF-02.AC-01
  type: ui
  priority: critical
  preconditions: [link de confirmação válido]
  expected: link confirma a conta (uso único: 2º acesso falha), conta fica confirmada e evento identidade.conta-confirmada é registrado no outbox
  automation: ephemeral
- id: CT-07
  requirement: RF-02.AC-02
  type: ui
  priority: high
  preconditions: [token alterado em 1 caractere]
  expected: confirmação não ocorre e a interface oferece caminho para pedir novo link
  automation: ephemeral
- id: CT-08
  requirement: RF-02.AC-02
  type: ui
  priority: high
  preconditions: [arranjo DB: expires_on do token da rodada no passado]
  expected: link expirado não confirma e a interface oferece reenvio
  automation: ephemeral
- id: CT-09
  requirement: RF-02.AC-03
  type: ui
  priority: critical
  preconditions: [conta não confirmada com link consumido/expirado]
  expected: reenvio gera novo e-mail/link para o mesmo endereço; 2º link confirma sem refazer cadastro
  automation: ephemeral
```

## U2 — Login, sessão, logout e fronteiras (RF-03, RF-04)

```yaml
- id: CT-10
  requirement: RF-03.AC-01
  type: ui
  priority: critical
  preconditions: [conta confirmada]
  expected: login cria sessão autenticada; identidade estável em getCurrentStudentSession
  automation: ephemeral
- id: CT-11
  requirement: RF-03.AC-02
  type: api
  priority: critical
  preconditions: []
  expected: e-mail inexistente e senha errada produzem resposta idêntica (status + code), sem sessão
  automation: ephemeral
- id: CT-13
  requirement: RF-03.AC-04
  type: api
  priority: high
  preconditions: [arranjo DB: deactivated_on em conta criada pela rodada]
  expected: login de conta desativada não cria sessão
  automation: ephemeral
- id: CT-14
  requirement: RF-03.AC-05
  type: ui
  priority: normal
  preconditions: [aguardar TTL de inatividade configurado]
  expected: renovação por atividade e expiração por inatividade
  automation: none
  note: previsto NOT_EXECUTED — exigiria aguardar janela de inatividade configurada (impraticável na rodada)
- id: CT-15
  requirement: RF-03.AC-06
  type: api
  priority: high
  preconditions: [conta confirmada]
  expected: segunda sessão não encerra a primeira; ambas permanecem válidas
  automation: ephemeral
- id: CT-16
  requirement: RF-03.AC-07
  type: api
  priority: high
  preconditions: [conta de ator interno existente (referência mascarada em evidências)]
  expected: registro e login de ator interno no fluxo de aluno são recusados; nenhuma Conta de aluno é criada
  automation: ephemeral
- id: CT-17
  requirement: RF-04.AC-01
  type: ui
  priority: critical
  preconditions: [sessão ativa]
  expected: logout encerra a sessão corrente; ação protegida posterior recebe 401
  automation: ephemeral
- id: CT-18
  requirement: RF-04.AC-02
  type: api
  priority: high
  preconditions: [duas sessões da mesma conta]
  expected: logout de uma sessão preserva a outra
  automation: ephemeral
- id: CT-19
  requirement: RF-04.AC-03
  type: api
  priority: normal
  preconditions: [sessão encerrada]
  expected: nova tentativa de logout não reativa sessão e encaminha à entrada
  automation: ephemeral
```

## U3 — Recuperação de senha (RF-05)

```yaml
- id: CT-20
  requirement: RF-05.AC-01
  type: ui
  priority: critical
  preconditions: [conta de aluno ativa]
  expected: pedido de recuperação recebe resposta neutra; e-mail com link e prazo chega ao smtp4dev
  automation: ephemeral
- id: CT-21
  requirement: RF-05.AC-02
  type: api
  priority: critical
  preconditions: []
  expected: e-mail sem conta elegível recebe resposta idêntica (status/corpo); nenhum token/pedido/e-mail gerado
  automation: ephemeral
- id: CT-22
  requirement: [RF-05.AC-03, RF-05.AC-06]
  type: ui
  priority: critical
  preconditions: [link de recuperação válido, senha antiga conhecida, sessão paralela ativa, 2º link pendente]
  expected: redefinição válida troca credencial (antiga falha, nova entra), encerra demais sessões e invalida os demais links pendentes
  automation: ephemeral
- id: CT-23
  requirement: RF-05.AC-04
  type: ui
  priority: high
  preconditions: [conta não confirmada com link de recuperação]
  expected: redefinição mantém conta não confirmada; login orienta confirmar e-mail
  automation: ephemeral
- id: CT-24
  requirement: RF-05.AC-05
  type: ui
  priority: high
  preconditions: [links usado, expirado (arranjo DB), alterado e token de confirmação]
  expected: nenhum muda a senha; solicitante pode pedir nova recuperação
  automation: ephemeral
- id: CT-25
  requirement: RF-05.AC-07
  type: ui
  priority: high
  preconditions: [link de recuperação válido]
  expected: senha fora da política não muda credencial e o mesmo token continua utilizável até o vencimento
  automation: ephemeral
```

## U4 — Troca de senha e CSRF (RF-06, RN-11)

```yaml
- id: CT-26
  requirement: [RF-06.AC-01, RF-06.AC-03]
  type: ui
  priority: critical
  preconditions: [sessão ativa + sessão paralela + link de recuperação pendente]
  expected: troca válida altera credencial, encerra demais sessões (401 na próxima ação), mantém a corrente, invalida links pendentes e registra identidade.senha-redefinida no outbox
  automation: ephemeral
- id: CT-27
  requirement: RF-06.AC-02
  type: ui
  priority: high
  preconditions: [sessão ativa + sessão paralela]
  expected: senha atual incorreta não altera credencial nem sessões (paralela permanece ativa)
  automation: ephemeral
- id: CT-28
  requirement: RF-06.AC-04
  type: ui
  priority: high
  preconditions: [sessão ativa]
  expected: nova senha fora da política não altera credencial nem sessões
  automation: ephemeral
- id: CT-29
  requirement: RN-11 / G18
  type: api
  priority: high
  preconditions: [sessão ativa]
  expected: escrita autenticada sem X-CSRF-Token devolve CSRF_INVALID sem efeito de negócio
  automation: ephemeral
```

## Exclusões e limitações

- Expiração por tempo testada somente via arranjo de `expires_on` no banco (não por espera de relógio).
- CT-14 (inatividade/expiração deslizante) previsto como NOT_EXECUTED: janela configurada inviável na rodada.
- "Conta desativada" sem fluxo de produto (CAP-031): arranjo direto em conta criada pela rodada.
- Ator interno sem credenciais conhecidas: sondagem negativa (registro/login recusados) sem mutação de dados existentes; e-mail mascarado nas evidências.
- Eventos de domínio verificados por persistência no outbox (sem assinantes nesta entrega).
- Idempotência de 24 h (decisão de TechSpec) fora do recorte desta rodada: não é critério de aceite do PRD.
