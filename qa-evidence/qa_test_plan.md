# Plano de QA — Acesso interno (CAP-002, tasks/archive/prd-acesso-interno)

Sessão `qa-cap002-acesso-interno-2026-10-07`. Expectativas derivadas exclusivamente do
PRD v1.1 (RF-01, RF-03 a RF-14), TechSpec e decisões OD22/OD25/OD26/DP-01 a DP-06.
**RF-02 (provisionamento do primeiro administrador) excluído** por exigir comando no host
do lab — decisão do usuário. Ambientes: `https://c4c-admin.lab.tasso.dev.br/admin`,
`https://c4c-student.lab.tasso.dev.br/student`, smtp4dev em `https://smtp.tasso.dev.br`,
banco de auditoria 192.168.0.5 (somente leitura).

## Dados de teste (resíduo autorizado)

| Conta | Uso |
|---|---|
| `admin@example.com` | administrador seed do lab (credenciais em `.env.test-credentials`) |
| `qa.cap002.professor@example.test` (E1) | professor; concessão/revogação/troca (U3/U4) |
| `qa.cap002.financeiro@example.test` (F1) | financeiro; área reservada e troca (U3/U4) |
| `qa.cap002.suporte@example.test` (S1) | suporte; troca dois atos e conta sem papel (U4) |
| `qa.cap002.fraca@example.test` | senha fora da política no aceite (CT-10) |
| `qa.cap002.normalizado@example.test` | normalização de e-mail (CT-07, convite nunca aceito) |
| `qa.cap002.aluno@example.test` | conta de aluno registrada pela rodada (CT-05/13/36) |

Marcadores `QA-CAP002-CTxx` nos motivos para rastreio na trilha. Automação: `ephemeral`
(Playwright, specs em `qa-evidence/spec`); casos de banco executados por `psql` somente
leitura; e-mails lidos pela API do smtp4dev.

## U1 — Convite e gestão de acesso (RF-03, RF-04, RF-12) → `u1-convite/`

Depende de: nenhum. Prepara aluno de teste e convites usados pelas demais unidades.

| ID | Requisito | Tipo | Prioridade | Esperado | Automação |
|---|---|---|---|---|---|
| CT-01 | RF-12.AC-01, RF-10.AC-01 | ui | critical | Admin entra e a gestão de acesso lista atores internos do tenant com papéis e convites pendentes | ephemeral |
| CT-02 | RF-03.AC-01 | ui | critical | Convite para e-mail sem conta com papel+motivo fica pendente e dispara e-mail | ephemeral |
| CT-03 | RF-03.AC-02 | ui | high | Motivo vazio e motivo só de espaços → campo apontado, convite não emitido | ephemeral |
| CT-04 | RF-03.AC-04 | ui | high | Convite para e-mail de conta interna → recusado orientando conceder papel à conta existente | ephemeral |
| CT-05 | RF-03.AC-05 | ui | high | Convite para e-mail de aluno → recusado orientando endereço institucional | ephemeral |
| CT-06 | RF-03.AC-06 (DP-04) | ui | high | Novo convite para e-mail com pendente → anterior deixa de valer, novo comunicado | ephemeral |
| CT-07 | RF-03.AC-07 | ui | normal | E-mail com maiúsculas/espaços nas bordas → normalizado antes das verificações | ephemeral |
| CT-08 | RF-04.AC-01 | ui+api | critical | E-mail de convite contém papel ofertado, link de aceite e data de validade | ephemeral |

## U2 — Aceite e entrada (RF-05, RF-10) → `u2-aceite-entrada/`

Depende de: U1 (convites emitidos).

| ID | Requisito | Tipo | Prioridade | Esperado | Automação |
|---|---|---|---|---|---|
| CT-09 | RF-05.AC-01 | ui | critical | Aceite com nome e senha válidos → conta interna ativa, convite aceito, entrada no backoffice com áreas do papel | ephemeral |
| CT-10 | RF-05.AC-03 | ui | high | Senha fora da política → conta não criada, regra não atendida apontada | ephemeral |
| CT-11 | RF-05.AC-04 | ui | high | Link de convite aceito reusado → mensagem de convite sem validade, nada além disso | ephemeral |
| CT-12 | RF-05.AC-02 | ui | high | Link do convite substituído → mensagem de convite sem validade, sem revelar dados | ephemeral |
| CT-13 | RF-10.AC-02 | ui | critical | Conta de aluno com credencial correta no backoffice → resposta igual a credencial inválida | ephemeral |
| CT-14 | RF-10.AC-04 | ui | high | E-mail inexistente e senha errada → respostas idênticas entre si | ephemeral |
| CT-15 | RF-10.AC-03 | ui | high | Conta interna no student SPA → resposta igual a credencial inválida | ephemeral |
| CT-16 | RF-10.AC-05 | ui | high | Sair → sessão encerrada; próxima ação exige nova entrada | ephemeral |

## U3 — Menor privilégio e área financeira (RF-13, RF-01) → `u3-menor-privilegio/`

Depende de: U2 (E1 professor, F1 financeiro ativos).

| ID | Requisito | Tipo | Prioridade | Esperado | Automação |
|---|---|---|---|---|---|
| CT-17 | RF-13.AC-01 | ui | critical | Professor: menu não oferece área financeira e link direto `/admin/financeiro` é recusado | ephemeral |
| CT-18 | RF-13.AC-02 | ui | critical | Ator com papel financeiro abre a área financeira | ephemeral |
| CT-19 | RF-13.AC-03, RF-01.AC-02 | ui | high | Professor+suporte: início do backoffice sem área financeira (união de permissões sem a financeira) | ephemeral |
| CT-20 | RF-13.AC-01 | api | critical | Professor: `GET /api/v1/finance-area` direto → 403 na borda | ephemeral |
| CT-21 | RF-13.AC-04, RF-07.AC-02 | ui | critical | Revogado financeiro com sessão aberta → próxima ação recusada sem esperar expiração | ephemeral |

## U4 — Conceder, revogar e trocar papel (RF-06 a RF-09, RF-12) → `u4-papeis/`

Depende de: U2/U3. Estado compartilhado: E1 professor, F1 financeiro, S1 suporte.

| ID | Requisito | Tipo | Prioridade | Esperado | Automação |
|---|---|---|---|---|---|
| CT-22 | RF-06.AC-01 | ui | critical | Concessão com motivo → papel passa a valer na próxima ação do ator | ephemeral |
| CT-23 | RF-06.AC-02 | ui | high | Conceder papel já detido → nada muda e nada comunicado à Auditoria | ephemeral |
| CT-24 | RF-12.AC-02, RF-06.AC-03 | ui+api | critical | Linha do próprio admin sem ações; concessão a si por chamada direta recusada | ephemeral |
| CT-25 | RF-12.AC-03, RF-06.AC-04 | ui+api | critical | Não-admin: link direto à gestão e chamada direta a operação de gestão recusados | ephemeral |
| CT-26 | RF-06.AC-05 | ui | high | Concessão sem motivo → motivo apontado como obrigatório, concessão não acontece | ephemeral |
| CT-27 | RF-07.AC-01 | ui | critical | Revogação de um de dois papéis com sessão aberta → sessões encerradas; reentrada só com papéis restantes | ephemeral |
| CT-28 | RF-07.AC-04 | ui+api | normal | Revogar papel não detido → nada muda e nada comunicado | ephemeral |
| CT-29 | RF-08.AC-01, RF-08.AC-02 | ui | high | Sem último papel → mensagem de conta sem acesso; novo papel concedido → áreas voltam no próximo acesso | ephemeral |
| CT-30 | RF-09.AC-01 | ui | critical | Troca suporte→financeiro numa ação → conta fica financeiro, desconectada, dois atos de mesmo autor/motivo | ephemeral |
| CT-31 | RF-09.AC-03 | ui | normal | Troca para papel já detido → equivale a revogar a origem, um único ato comunicado | ephemeral |

## U5 — Auditoria dos atos (RF-14) → `u5-auditoria/`

Depende de: U1 a U4 (atos praticados com marcadores únicos).

| ID | Requisito | Tipo | Prioridade | Esperado | Automação |
|---|---|---|---|---|---|
| CT-32 | RF-14.AC-01 | persistence | critical | Cada um dos quatro tipos de ato da rodada tem exatamente um registro conforme, com autor, alvo, papel e motivo corretos | none (psql) |
| CT-33 | RF-14.AC-02 | persistence | high | Atos recusados/falhos da rodada (self, sem motivo, convites recusados, papel não detido, repetido) → nenhum registro | none (psql) |
| CT-34 | RF-14.AC-04 | persistence | critical | Nenhum registro da rodada contém e-mail, nome ou texto além do motivo | none (psql) |

## U6 — Recuperação de senha do ator interno (RF-11) → `u6-recuperacao/`

Depende de: U2 (conta interna ativa) e aluno de U1.

| ID | Requisito | Tipo | Prioridade | Esperado | Automação |
|---|---|---|---|---|---|
| CT-35 | RF-11.AC-01 | ui+api | high | Pedido com conta interna → resposta neutra e e-mail de redefinição com link do backoffice | ephemeral |
| CT-36 | RF-11.AC-03 | ui+api | high | Pedido com e-mail de aluno → mesma resposta na tela e nenhum e-mail de redefinição | ephemeral |
| CT-37 | RF-11.AC-02 | ui | high | Link válido redefine → sessões anteriores encerradas e link deixa de valer | ephemeral |

## Fora de escopo

- **RF-02** provisionamento do primeiro administrador (decisão do usuário; requer comando no host).
- Cancelar/reenviar convite, listar convites expirados (fora do MVP do PRD).
- Consulta da trilha pelo administrador (segundo PRD de CAP-030).
- Falha do broker no meio do ato (RF-14.AC-03): exigiria derrubar RabbitMQ do lab compartilhado.
- Vazamento em telemetria (RF-04.AC-03): coberto pela rodada CAP-030 para o mesmo pipeline; sem acesso aos logs de todos os serviços desta vez.

## Ordem e dependências

U1 → U2 → U3 ∥ U4 (estado compartilhado de E1/F1/S1, executadas em sequência no mesmo
arranjo) → U5 (consolidação da trilha) ∥ U6 (independente após U2). Total: 37 casos.
