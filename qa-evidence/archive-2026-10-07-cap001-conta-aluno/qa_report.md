# QA Report — CAP-001 Conta e autenticação do aluno

- **Rodada:** qa-cap001-conta-aluno-2026-10-07 (início 13:36 UTC)
- **Artefato sob teste:** `tasks/archive/prd-conta-aluno/prd.md` v1.1 (RF-01 a RF-06) + TechSpec aprovada + regras RN do domain doc
- **Ambiente:** lab remoto (`c4c-student.lab.tasso.dev.br`), BFF `/api/v1`, smtp4dev (`smtp.tasso.dev.br`), PostgreSQL `identity_access`
- **Plano aprovado pelo usuário:** execução completa com arranjo de DB em dados da própria rodada (CT-08, CT-13, CT-24) e sondagem negativa com e-mail de ator interno (CT-16)

## Resultado geral

| Status | Total |
|---|---|
| PASS | 28 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT_EXECUTED | 1 (CT-14, motivo previsto no plano) |

**Resultado geral: APROVADO** após revalidação de 2026-10-07 (~14:45 UTC). Os 3 FAIL da primeira execução (CT-06, CT-22, CT-26 — publicação dos fatos `identidade.*` rejeitada pelo RabbitMQ, issue #180) foram corrigidos pelo commit `b0d455a` e revalidados com deploy efetivo (`7aa5ba8`). Histórico da falha preservado abaixo.

## Falhas (histórico da 1ª execução — revalidadas e corrigidas)

> Os três casos abaixo falharam na primeira execução pela mesma causa sistêmica. Após o fix `b0d455a` (fila quorum `identity.account-fact-retention` ligada às três chaves de fato) e deploy efetivo, os três foram reexecutados com as mesmas expectativas e **PASSARAM** (ver seção Reteste).

### CT-06 — RF-02.AC-01 (confirmação publica `identidade.conta-confirmada`) — FAIL → PASS (reteste)

- **Expected:** link válido confirma a conta, o link deixa de funcionar e `identidade.conta-confirmada` é publicado.
- **Actual:** confirmação, uso único e persistência funcionam (conta `is_confirmed=true`, `consumed_on` registrado, reuso do link recusado). Porém o evento fica retido no outbox sem publicação: `StudentPasswordResetV1`/`StudentAccountConfirmedV1` com `attempts=10` e `last_error="RabbitMQ rejected the outbox message."` no exchange `identity.events`.
- **Passo da divergência:** após o commit de confirmação, o outbox registra a intenção, o broker rejeita a publicação e o retry esgota (cap 10).
- **Evidências:** `u1-cadastro-confirmacao/ct-06-outbox-fatos-nao-publicados.txt` (mostra os 3 tipos de fato rejeitados desde 2026-09-28), `ct-06-confirmado.png`, `ct-06-reuso-link-invalido.png`.

### CT-22 — RF-05.AC-03 (redefinição publica `identidade.senha-redefinida`) — FAIL → PASS (reteste)

- **Expected:** redefinição válida troca a Credencial, invalida demais links, encerra demais sessões e publica `identidade.senha-redefinida`.
- **Actual:** todos os efeitos funcionais observados e corretos (senha antiga 401 / nova 200; sessão paralela 401; link pendente 422 `PASSWORD_RESET_REJECTED`). A publicação do evento é rejeitada pelo broker (mesma causa de CT-06).
- **Evidências:** `u3-recuperacao/ct-22-*.json|txt` (inclui `ct-22-outbox-senha-redefinida.txt`).

### CT-26 — RF-06.AC-01 (troca publica `identidade.senha-redefinida`) — FAIL → PASS (reteste)

- **Expected:** troca válida altera Credencial, encerra demais sessões, invalida links pendentes e publica `identidade.senha-redefinida`.
- **Actual:** efeitos funcionais corretos (sessão paralela 401; corrente 200; senha antiga 401 / nova 200; link pendente 422; notificação na UI "Senha trocada. Encerramos as outras sessões."). Publicação do evento rejeitada (mesma causa sistêmica).
- **Evidências:** `u4-troca-senha/ct-26-*` (inclui `ct-26-outbox-senha-redefinida.txt`, `ct-26-troca-concluida-notificacao.png`).

**Classificação comum:** os fatos `identidade.conta-criada.v1`, `identidade.conta-confirmada.v1` e `identidade.senha-redefinida.v1` destinam-se ao exchange `identity.events` e acumulam `attempts=10` com erro "RabbitMQ rejected the outbox message." desde 2026-09-28. Os pedidos `notificacao.envio-solicitado.v1` (exchange `notification.events.default`) publicam e são processados normalmente — os e-mails de confirmação e recuperação chegaram ao smtp4dev em todos os casos.

## Não executado

| Caso | Motivo |
|---|---|
| CT-14 (RF-03.AC-05 — renovação/expiração por inatividade) | Exigiria aguardar a janela de inatividade configurada da sessão; inviável dentro da rodada. Previsão registrada no plano aprovado. |

## Resultado por unidade

### U1 — Cadastro e confirmação (RF-01, RF-02) — `u1-cadastro-confirmacao/`

| Caso | Req. | Status | Resumo |
|---|---|---|---|
| CT-01 | RF-01.AC-01 | PASS | Conta não confirmada + 1 credencial + 1 token; UI "Confira seu e-mail"; link no smtp4dev; prazo do e-mail (24 h) coincide com validade aplicada no banco |
| CT-02 | RF-01.AC-02 | PASS | 422 `ACCOUNT_ALREADY_EXISTS`; nenhuma conta/credencial nova |
| CT-03 | RF-01.AC-03 | PASS | E-mail com maiúsculas/espaços tratado como a mesma identidade normalizada |
| CT-04 | RF-01.AC-04 / RF-03.AC-03 | PASS | Senha correta → orientação de confirmar; senha errada → mensagem genérica |
| CT-05 | RF-01.AC-05 | PASS | 4 variantes fora da política → 422 `PASSWORD_POLICY_VIOLATION`; 0 contas criadas |
| CT-06 | RF-02.AC-01 | PASS (reteste) | Confirmação, uso único e publicação do evento confirmados (ver Reteste) |
| CT-07 | RF-02.AC-02 | PASS | Token alterado → "Este link não vale mais" + reenvio oferecido |
| CT-08 | RF-02.AC-02 | PASS | Link expirado (arranjo DB) → não confirma + reenvio oferecido |
| CT-09 | RF-02.AC-03 | PASS | Reenvio gera novo link; 2º link confirma sem refazer cadastro |

### U2 — Login, sessão, logout e fronteiras (RF-03, RF-04) — `u2-login-sessao/`

| Caso | Req. | Status | Resumo |
|---|---|---|---|
| CT-10 | RF-03.AC-01 | PASS | Sessão ativa; `getCurrentStudentSession` 200 com identidade estável |
| CT-11 | RF-03.AC-02 | PASS | E-mail inexistente e senha errada → 401 com corpo idêntico, sem cookie |
| CT-13 | RF-03.AC-04 | PASS | Conta desativada (arranjo) → 401 sem sessão |
| CT-14 | RF-03.AC-05 | NOT_EXECUTED | Ver quadro acima |
| CT-15 | RF-03.AC-06 | PASS | Duas sessões simultâneas ativas |
| CT-16 | RF-03.AC-07 | PASS | E-mail de ator interno: registro 422 e login 401; 0 contas Student criadas (e-mail mascarado, ref. sha16 `258d8dc916db8cea`) |
| CT-17 | RF-04.AC-01 | PASS | Logout UI encerra sessão; ação protegida posterior 401 |
| CT-18 | RF-04.AC-02 | PASS | Logout da sessão B preserva a sessão A |
| CT-19 | RF-04.AC-03 | PASS | Logout reiterado 204 sem reativar; `current` 401 |

### U3 — Recuperação de senha (RF-05) — `u3-recuperacao/`

| Caso | Req. | Status | Resumo |
|---|---|---|---|
| CT-20 | RF-05.AC-01 | PASS | Resposta neutra; link recebido; texto "vale por 1 hora" = validade aplicada (1 h) |
| CT-21 | RF-05.AC-02 | PASS | Elegível e inexistente → 202 corpo vazio idêntico; 0 tokens/e-mails para inexistente |
| CT-22 | RF-05.AC-03/.AC-06 | PASS (reteste) | Efeitos funcionais e publicação do evento confirmados (ver Reteste) |
| CT-23 | RF-05.AC-04 | PASS | Conta não confirmada permanece não confirmada; login → `EMAIL_NOT_CONFIRMED` |
| CT-24 | RF-05.AC-05 | PASS | Usado/alterado/finalidade trocada/expirado → 422 `PASSWORD_RESET_REJECTED`; credencial intacta; nova solicitação aceita |
| CT-25 | RF-05.AC-07 | PASS | Senha fraca não muda credencial e o mesmo token conclui com senha válida |

### U4 — Troca de senha e CSRF (RF-06, RN-11) — `u4-troca-senha/`

| Caso | Req. | Status | Resumo |
|---|---|---|---|
| CT-26 | RF-06.AC-01/.AC-03 | PASS (reteste) | Efeitos funcionais e publicação do evento confirmados (ver Reteste) |
| CT-27 | RF-06.AC-02 | PASS | Senha atual incorreta → credencial e sessões preservadas |
| CT-28 | RF-06.AC-04 | PASS | Nova senha fora da política → nada muda |
| CT-29 | RN-11/G18 | PASS | Sem `X-CSRF-Token` → 403 `CSRF_INVALID`; credencial intacta |

## Escopo excluído

- Idempotência pública de 24 h (decisão de TechSpec): não é critério de aceite do PRD; não coberto.
- Entrega a destinatários externos / provedor real: dependência de CAP-026 em produção; smtp4dev cobre o fluxo local conforme DP-06.
- Ator interno com credenciais válidas (RF-03.AC-07 parte "ator interno tenta entrar"): sem credenciais conhecidas; cobertura dada pelas sondagens negativas de CT-16.

## Observações (sem impacto em AC)

- Logout e escritas autenticadas exigem `Origin` + `Idempotency-Key` + `X-CSRF-Token`; ausência de `Origin` retorna `CSRF_INVALID` — coerente com a proteção de origem da TechSpec.
- A SPA remove o token da query string ao capturar o link (observado em `/confirm-account` e `/redefinir-senha`).
- Cookie de sessão é opaco; nenhuma resposta inspecionada expôs JWT ao navegador.

## Candidatos à automação persistente (não promovidos)

- CT-24/CT-25 (uso único/expiração/finalidade de tokens de redefinição e política preservando token) — regra crítica de segurança com boa relação custo/benefício de regressão.
- CT-11/CT-21 (respostas indistinguíveis) — fronteira anti-enumeração.
- Bloqueio atual: não foi localizada suíte E2E estabelecida no repositório para os SPAs; promover exigiria criá-la por decisão do time.

## Reteste pós-correção (issue #180) — 2026-10-07 — APROVADO

Correção: `b0d455a fix(identity): publica fatos de conta quando ainda não há consumidor` — topologia declara a fila quorum `identity.account-fact-retention` ligada a `identidade.conta-criada.v1`, `identidade.conta-confirmada.v1` e `identidade.senha-redefinida.v1`, com `x-max-length=10000`, `x-message-ttl=604800000` (7 dias) e `x-overflow=drop-head`. Deploy efetivo confirmado: imagem `identity:7aa5ba8…` (contém `b0d455a`), container up, fila criada com os argumentos e bindings esperados.

### Sequência do reteste

1. **1ª tentativa (BLOCKED, ~15:00 UTC):** o container ainda rodava a imagem `69398e6` (sem o fix; up 18 h); fila inexistente; reset de tentativas aplicado a mando do usuário foi reprocessado pelo worker antigo e rejeitado (25 linhas de volta a `attempts=10`, `processed=0`). Sem efeito líquido. Evidência: `u1-cadastro-confirmacao/reteste-container-identity-em-execucao.txt`.
2. **Após redeploy válido:** novo reset das 25 linhas → worker publicou **25/25** (`processed_on` preenchido, sem erro); fila de retenção com 25 mensagens prontas.
3. **CT-06 reexecutado** (conta `qa.retest.aluno6@example.test`): cadastro → e-mail → confirmação pela UI ("E-mail confirmado"); `StudentAccountCreatedV1` e `StudentAccountConfirmedV1` **processados** (11:43:20 e 11:43:34 -03, sem erro); reuso do link → 422 `CONFIRMATION_LINK_INVALID`; fila 25→27. Evidências: `u1-cadastro-confirmacao/reteste-ct-06-*.png|json`.
4. **CT-22 reexecutado:** redefinição via link (204) → senha antiga 401 / nova 200; sessão paralela 401; `StudentPasswordResetV1` **processado** (11:44:40 -03, sem erro); fila 27→28. Evidências: `u3-recuperacao/reteste-ct-22-*`.
5. **CT-26 reexecutado:** troca autenticada via API com CSRF (204) → sessão paralela 401, corrente 200, login com senha final 200; `StudentPasswordResetV1` **processado** (11:45:16 -03, sem erro); fila 28→29. Evidências: `u4-troca-senha/reteste-ct-26-*`.

**Conclusão do reteste:** CT-06, CT-22 e CT-26 **PASS** com as mesmas expectativas do plano original. Publicação dos fatos confirmada por outbox (`processed_on` sem erro) e por contagem de mensagens na fila `identity.account-fact-retention` (25 → 29, coerente com o backlog + 4 eventos novos).

## Estado deixado pelo ambiente

- Contas de teste da rodada e do reteste sob `qa.cap001.*@example.test` e `qa.retest.aluno6@example.test`; `aluno2` permanece desativada (arranjo do CT-13); tokens consumidos/expirados pertencem somente a contas da rodada. Nenhum dado pré-existente foi alterado (e-mail de ator interno apenas sondado, sem mutação).
- Backlog de 25 fatos do outbox foi publicado para a fila de retenção (operação autorizada pelo usuário).
