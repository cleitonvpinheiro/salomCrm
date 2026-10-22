# Plano de Implementação — Refatoração i18n + Docs

Mapeamento 1:1 com Critérios de Aceitação do spec.md. Ordem de dependência: Tarefas de fundação (dict organizado + novas chaves) → refatoração de componentes (do mais crítico ao menos) → ajustes compartilhados → verificação → documentação.

---

## Task 1: Organizar e completar o dicionário de traduções (`i18n.tsx`)

**Descrição:**
Reescrever `frontend/src/lib/i18n.tsx` consolidando os 7 blocos de `Object.assign` em 3 objetos literais limpos (`translations["pt-BR"]`, `translations.en`, `translations.es`). Remover as 2 chaves duplicadas no pt-BR. Inserir TODAS as novas chaves descobertas na análise (strings hardcoded de todos os 14 arquivos) nos 3 idiomas, com traduções reais em pt-BR e es (não fallback). Manter o mecanismo de fallback automático de en = chave para strings cuja chave já é o en correto. Preservar TODAS as interpolações `{var}` iguais nos 3 idiomas.

**Prioridade:** high (todas as outras tasks dependem das chaves existirem no dicionário)

**Depende de:** Nenhuma (primeira task)

**Critérios de Aceitação pais:** AC-04, AC-05, AC-06

**Test Requirements (TRs):**
- **TR 1.1 (rule):** Estrutura do arquivo contém no máximo 4 blocos de inicialização: (a) tipo Locale + translations.pt-BR literal, (b) translations.en gerado por fallback + overlays pontuais, (c) translations.es literal completo, (d) Context/Provider/hook. Menos de 3 `Object.assign` totais.
- **TR 1.2 (rule):** Executar em runtime (ou script ad-hoc): `Object.keys(translations["pt-BR"]).length === new Set(Object.keys(translations["pt-BR"])).size` === true (0 duplicatas).
- **TR 1.3 (rule):** `Object.keys(translations["pt-BR"]).every(k => translations.es.hasOwnProperty(k))` === true (es cobre 100% das chaves pt-BR).
- **TR 1.4 (rule):** Para toda chave em que `translations["pt-BR"][k].includes("{")`, verificar que `translations.es[k]` contém o(s) mesmo(s) nome(s) de placeholder entre chaves.
- **TR 1.5 (rubric, 0-2, ≥1):** Qualidade das novas traduções pt-BR/es inseridas para ~60-80 novas chaves. ≥1 = 90%+ adequadas no domínio salão; ≤3 anglicismos. 2 = 100% perfeitas.

**Status:** pending

**Completion Evidence:** (será preenchido durante Implement)

---

## Task 2: Refatorar `ClientsDashboard.tsx` + `KpiStatCards.tsx` + `ClientTable.tsx`

**Descrição:**
Aplicar `useI18n()` em 3 arquivos do módulo Clientes — página principal (SORT_OPTIONS, filter tabs, filtros arquivados, input de busca, select de sort, KPIs passados via tabs, toasts de archive/restore/delete mutation, pagination "Showing X–Y of Z", Previous/Next buttons, error state messages, confirm dialog title/description/confirmLabel title/subtitle do AppShell e button "Add client").

- `KpiStatCards.tsx`: labels dos 4 cards e hints. NÃO usa mais literais.
- `ClientTable.tsx`: headers da tabela, "Unassigned", empty state "No clients found" / extended description.
- `ClientsDashboard.tsx`: tudo acima + confirm dialog props (confirmar que ConfirmDialog ainda aceita props de texto — a ser implementado em Task 10).

**Prioridade:** high

**Depende de:** Task 1 (dicionário pronto com todas as chaves), Task 10 (para ConfirmDialog aceitar `t()` default — mas pode passar props por enquanto, como hoje já faz)

**Critérios de Aceitação pais:** AC-01 (pontos 1, 6, 7), AC-12 (data-testids intactos), AC-15

**Test Requirements (TRs):**
- **TR 2.1 (rule):** Grep por padrões hardcoded conhecidos nos 3 arquivos. Strings UI como `"Total clients"`, `"in the book"`, `"Search name, phone, formula…"`, `"Showing "`, `"Previous"`, `"Next"`, `"Archive client?"`, `"The client will leave…"` aparecem 0 vezes como literais cruas (apenas como argumento de `t(...)`).
- **TR 2.2 (rule):** Nenhum `data-testid` existente nos 3 arquivos foi renomeado ou removido. Verificar diff atributos.
- **TR 2.3 (rule):** `toast.success` e `toast.error` nos 3 arquivos usam `t(...)` como primeiro argumento — zero literais cru.
- **TR 2.4 (rule):** Interpolação `"Showing {from}–{to} of {total}"` é usada via `t(key, {from, to, total})` em ClientsDashboard pagination.
- **TR 2.5 (rule):** `AppShell` title/subtitle passados por ClientsDashboard e Stylists/Services/Team estão em inglês cru? Esperado: continuar string em inglês (porque TopNav já faz `t(title)` e `t(subtitle)` em linha 58-60 do TopNav). Validar que esta convenção (pai passa chave en cru → TopNav traduz) continua consistente.

**Status:** pending

---

## Task 3: Refatorar `AgendaPage.tsx` + `STATUS_META` e paginação/estados

**Descrição:**
Aplicar `useI18n()` em AgendaPage. STATUS_META (scheduled/completed/cancelled) vira objeto com chaves e lookup via `t()`. Toasts de complete/cancel/delete success/error. Botões: "Today", "Previous", "Next", "Complete", "Cancel" actions. Error state "The agenda is out of reach" / "We couldn't load the bookings". Empty state "Nothing booked this day" / "Pick another day on the strip above, or book the first appointment". Título do dia: contagem de appointments `"appointment"` / plural `"appointments"` via `t(count === 1 ? "appointment" : "appointments")`. Pagination "Showing X–Y of Z". Subtitle do AppShell. ConfirmDialog title/description/confirmLabel.

**Prioridade:** high

**Depende de:** Task 1, Task 10 (ConfirmDialog)

**Critérios de Aceitação pais:** AC-01 (ponto 2), AC-12, AC-15

**Test Requirements (TRs):**
- **TR 3.1 (rule):** STATUS_META não contém strings literais de label. Usa chaves e componente consome `t(meta.labelKey)` (ou similar).
- **TR 3.2 (rule):** Toasts do appointment (6 mutations) todos usam `t()`.
- **TR 3.3 (rule):** Error + empty + loading + pagination strings não aparecem como literais cru.
- **TR 3.4 (rule):** "Today" button usa `t("Today")`.

**Status:** pending

---

## Task 4: Refatorar `StylistsPage.tsx` + `StylistCard` interno + banner

**Descrição:**
Aplicar `useI18n()` no StylistCard (labels "Active" / "Away", plural "client"/"clients" do count). Aplicar na página (banner "Atelier · The floor", "The stylist roster", error state "The roster is out of reach", empty state "No stylists yet" / "Add your first stylist...", "Try again", AppShell title/subtitle, button "Add stylist", toast archive/delete mutation, ConfirmDialog title/description/confirmLabel "Archive stylist").

**Prioridade:** high

**Depende de:** Task 1, Task 10

**Critérios de Aceitação pais:** AC-01 (ponto 3), AC-12, AC-15

**Test Requirements (TRs):**
- **TR 4.1 (rule):** Plural `client/clients` em StylistCard usa `t(count === 1 ? "client" : "clients")`.
- **TR 4.2 (rule):** Status "Active"/"Away" usa `t()`.
- **TR 4.3 (rule):** Todos os toasts (success/error archive e load) usam `t()`.
- **TR 4.4 (rule):** Banner heading e eyebrow ("Atelier · The floor", "The stylist roster") via `t()`.

**Status:** pending

---

## Task 5: Refatorar `ServicesPage.tsx` + tabela e status

**Descrição:**
Aplicar `useI18n()` em ServicesPage. Table headers ("Service", "Duration", "Price", "Status", "Actions"), duração "{n} min" via interpolação ou `t("min")` concatenado? Preferir interpolação `"Duration min"` = `"{min} min"`. Status "Active" / "Inactive" via `t()`. Error state "The menu is out of reach", empty state "No services yet" / "Add the first service...", "Try again", AppShell title/subtitle, button "Add service", toast delete/load, ConfirmDialog title/description/confirmLabel "Remove service".

**Prioridade:** high

**Depende de:** Task 1, Task 10

**Critérios de Aceitação pais:** AC-01 (ponto 4), AC-12

**Test Requirements (TRs):**
- **TR 5.1 (rule):** 5 headers tabela + status Active/Inactive via `t()`.
- **TR 5.2 (rule):** Error + empty states via `t()`.
- **TR 5.3 (rule):** Toasts success/error delete mutation via `t()`.
- **TR 5.4 (rule):** AppShell title/subtitle ainda são chaves cru; TopNav faz `t()` (convenção existente).

**Status:** pending

---

## Task 6: Refatorar `TeamPage.tsx`

**Descrição:**
Aplicar `useI18n()` em TeamPage. AppShell title/subtitle, heading "Add a teammate", form fields ("Name", "E-mail", "Temporary password (10+ characters)", "Role", options do select: "Team member" / "Administrator"), button "Adding…" / "Add teammate". Section heading "Workspace access", error load "Could not load team members", select role options ("Team"/"Admin") devem usar `t(...)`, botão "Disable" / "Enable".

**Prioridade:** high

**Depende de:** Task 1

**Critérios de Aceitação pais:** AC-01 (ponto 5), AC-12

**Test Requirements (TRs):**
- **TR 6.1 (rule):** 3 fields e select label + 2 options via `t()`.
- **TR 6.2 (rule):** Section heading "Workspace access" + erro de load via `t()`.
- **TR 6.3 (rule):** Botões "Disable"/"Enable" e "Adding…"/"Add teammate" via `t()`.
- **TR 6.4 (rule):** Toasts create/update success/error via `t()`.

**Status:** pending

---

## Task 7: Refatorar Drawer e timeline de cliente: `ClientDetailDrawer.tsx` + `NotesTimeline.tsx` + `ClientFormModal.tsx`

**Descrição:**
- **ClientDetailDrawer.tsx:** KIND_LABELS (4 tipos) viram objetos com chave → `t()`. Todos os toasts (reassign, add note, log visit success/error). Loading states: "Loading client…", "Select a client to see their history". SheetDescription arquivado e "Client of X" / "No preferred stylist yet". Section headers "Contact", "Hair profile", "Type:", "Preferred stylist", "Last visit", "Notes & history". Botão "Log today" / "Logging…". "Load older notes", "Loading history…". Textarea placeholder "Add a note — formulas, preferences, allergies…" e nota select "Kind" labels. "Born" antes da data.
- **NotesTimeline.tsx:** KIND_META 4 labels ("Visit", "Formula", "Allergy", "Note") via `t()`; empty state "No notes yet — add the first one below.".
- **ClientFormModal.tsx:** title "New client" / "Edit client" via `t()`; description create/update via `t()`; fields labels ("Name", "Phone", "E-mail", "Birthday", "Preferred stylist", "Hair type/texture", "Last visit", "Primary formula/allergies", "Tags (comma separated)"); toast success/error "A name is required". Buttons save/cancel.

**Prioridade:** high

**Depende de:** Task 1

**Critérios de Aceitação pais:** AC-01 (pontos 8, 9, 10), AC-12

**Test Requirements (TRs):**
- **TR 7.1 (rule):** 4 labels de nota (em NotesTimeline KIND_META e ClientDetailDrawer KIND_LABELS) usam `t()`.
- **TR 7.2 (rule):** 6 headers de section no drawer via `t()`.
- **TR 7.3 (rule):** Empty states + loading states no drawer + timeline via `t()`.
- **TR 7.4 (rule):** Modal ClientForm labels/title/description/toasts via `t()`. "Unassigned" do stylist dropdown via `t()`.

**Status:** pending

---

## Task 8: Refatorar `AppointmentFormModal.tsx`

**Descrição:**
Aplicar `useI18n()` no modal de agendamento. Title "New appointment" / "Edit appointment" + descriptions. Form labels "Client", "Service", "Professional", "Date", "Time", "Notes". Fallback selects: "Choose a client", "Choose a service", "Unassigned". "Load more clients", "Loading clients…". Placeholders "Pick a day", "Anything the team should know — optional". Toasts validação "Choose a client", "Choose a service", "Pick the date and time", sucesso/erro save mutation. Buttons footer "Cancel", "Saving…", "Save changes", "Book appointment".

**Prioridade:** high

**Depende de:** Task 1

**Critérios de Aceitação pais:** AC-01 (ponto 11), AC-12

**Test Requirements (TRs):**
- **TR 8.1 (rule):** Title + 2 descriptions via `t()`.
- **TR 8.2 (rule):** 5 labels de campo + placeholders + fallbacks via `t()`.
- **TR 8.3 (rule):** 3 toasts validação + 1 sucesso/erro salvar via `t()`.
- **TR 8.4 (rule):** Buttons footer ("Cancel", "Book appointment", "Save changes", "Saving…") via `t()`.

**Status:** pending

---

## Task 9: Refatorar `StylistFormModal.tsx` + `ServiceFormModal.tsx`

**Descrição:**
- **StylistFormModal:** COLOR_OPTIONS 6 cores ("Terracotta", "Caramel", "Forest", "Ink blue", "Amber", "Rosewood") viram labels com `t()`. Title/description create/update. Labels "Name", "Specialty / title", "Tag colour", "Active on the floor". Toast save error, "A name is required" validação, save success.
- **ServiceFormModal:** Title/description "New service" / "Edit service". Labels "Name", "Description", "Duration (min)", "Price (R$)", "Active — available for booking". Placeholder "e.g. Signature Cut & Blow-Dry". Validação "A name is required" + toast save error/success. Buttons.

**Prioridade:** high

**Depende de:** Task 1

**Critérios de Aceitação pais:** AC-01 (pontos 12, 13), AC-12

**Test Requirements (TRs):**
- **TR 9.1 (rule):** 6 nomes de cores do StylistForm usam `t()`.
- **TR 9.2 (rule):** StylistForm title/description/4 labels/validação/toasts via `t()`.
- **TR 9.3 (rule):** ServiceForm title/description/4 labels/placeholder/validação/toasts via `t()`.
- **TR 9.4 (rule):** "The menu the whole team books from." (description do ServiceForm) via `t()` (chave já existe no dict).

**Status:** pending

---

## Task 10: Refatorar `ConfirmDialog.tsx` (componente compartilhado)

**Descrição:**
Remover literais `"Cancel"` e `"Removing…"` hardcoded. Opção escolhida: **props opcionais + default via `t()`** (para manter flexibilidade). Implementar:
- `cancelLabel?: string` = default `undefined` → no render: `cancelLabel ?? t("Cancel")`
- Adicionar nova prop opcional `pendingLabel?: string` = default `undefined` → substitui `"Removing…"` literal por `pendingLabel ?? t(confirmLabel.startsWith("Remove") ? "Removing…" : "Processing…")` (ou abordagem mais simples: `pendingLabel` prop obrigatória quando confirmLabel dinâmico; senão default `t("Processing…")`).
- **Importante:** O componente ConfirmDialog NÃO é filho direto do Provider? É filho — sim, roda dentro da app tree. Portanto `useI18n()` dentro dele FUNCIONA.

**Prioridade:** high (todas as tasks 2,3,4,5 usam ConfirmDialog)

**Depende de:** Task 1 (chave "Cancel" / "Processing…" existir)

**Critérios de Aceitação pais:** AC-02, AC-12

**Test Requirements (TRs):**
- **TR 10.1 (rule):** Busca literal `"Cancel"` no arquivo → 0 ocorrências fora de chave de dicionário/comentário.
- **TR 10.2 (rule):** Busca literal `"Removing…"` → 0 ocorrências.
- **TR 10.3 (rule):** `ConfirmDialog` importa `useI18n` e usa `t()` como fallback default.

**Status:** pending

---

## Task 11: Corrigir Sidebar toast logout + refatorar `visitMeta` (`lib/format.ts`) + plural clients/stylists cards

**Descrição:**
Duas sub-tarefas:
1. **Sidebar toast fix:** `toast.success("Signed out — see you soon")` → `toast.success(t("Signed out — see you soon"))`. Adicionar chave aos 3 dicionários (já existirá via Task 1).
2. **Refatorar `visitMeta` (RF-02 Opção A):** Transformar `lib/format.ts` função `visitMeta()` para retornar `{ labelKey: string; tone: VisitTone; params?: Record<string, number> }` em vez de `{label: string; tone}`. Adicionar `labelKey` para cada case:
   - `null/undefined` → `"No visit logged"` (chave)
   - `0` → `"Visited today"`
   - `1` → `"Yesterday"`
   - `days <= 20` → `"X days ago"` (chave com interpolação `{days}`) → params: `{days}`
   - `weeks === 1` → `"1 week ago"`
   - `days <= 56, weeks > 1` → `"{weeks} weeks ago"` (params: `{weeks}`)
   - `> 56` → `"{weeks} weeks ago · recall due"` (ou chave composta preferencialmente única: `"recall_due_weeks"` = `"{weeks} weeks ago · recall due"` via interpolação)
3. **Atualizar consumidores de `visitMeta`:** Os locais `ClientTable.tsx` e `ClientDetailDrawer.tsx` (linha 180 e 267) que renderizam `meta.label` devem agora fazer `t(meta.labelKey, meta.params ?? {})`. (NOTA: Task 2 e Task 7 já devem cobrir essa atualização ao serem implementadas — se Task 11 rodar ANTES de 2/7, ajustar juntos.)

**Prioridade:** medium

**Depende de:** Task 1

**Critérios de Aceitação pais:** AC-03, AC-07

**Test Requirements (TRs):**
- **TR 11.1 (rule):** Sidebar `handleLogout` → `toast.success(t(...))`.
- **TR 11.2 (rule):** `lib/format.ts` função `visitMeta` não retorna mais literais de frase em inglês direto no `.label`; retorn `.labelKey` (string que é chave do dict).
- **TR 11.3 (rule):** Consumidores de `visitMeta` (2 locais) aplicam `t(meta.labelKey, meta.params)`.

**Status:** pending

---

## Task 12: Verificar builds + testes

**Descrição:**
Executar todos os comandos de verificação e garantir passagem limpa:
1. `cd frontend && yarn typecheck`
2. `cd frontend && yarn lint`
3. `cd frontend && yarn build`
4. `cd backend && python -m pytest`

Se typecheck falhar por tipos (ex: `t()` recebendo string que a pessoa queria estreitar), ajustar tipos no RNF-05 (se aplicável) ou manter `t(text: string)`. Qualquer warning de build deve ser investigado (não precisa de 0 warnings, mas 0 erros).

**Prioridade:** high

**Depende de:** Tasks 1–11 completas (todas as refatorações aplicadas)

**Critérios de Aceitação pais:** AC-08, AC-09, AC-10, AC-11

**Test Requirements (TRs):**
- **TR 12.1 (rule):** `yarn typecheck` exit code 0, 0 erros TypeScript.
- **TR 12.2 (rule):** `yarn lint` (oxlint) exit code 0.
- **TR 12.3 (rule):** `yarn build` exit code 0 + pasta `dist/` produzida com sucesso.
- **TR 12.4 (rule):** `python -m pytest` exit code 0 (backend não alterado — só confirmar não-regressão).

**Status:** pending

---

## Task 13: Criar `PROJECT_DOCS.md` (documentação consolidada)

**Descrição:**
Criar arquivo `c:\salomCrm\PROJECT_DOCS.md` com as 12 seções do RF-06:
1. Visão Geral do Produto
2. Arquitetura Geral (padrão multi-tenant shared DB + middleware tenancy)
3. Stack Tecnológica Completa (cada biblioteca com 1 frase de justificativa)
4. Estrutura de Pastas (backend/, frontend/, tests/)
5. Modelo de Dados MongoDB (coleções + campos chave + regras de negócio)
6. Autenticação e Autorização (3 níveis, cookie httpOnly, recuperação senha)
7. Fluxos Principais (Cadastro Cliente → Agendamento → Conclusão; Gestão Equipe; Gestão Tenants)
8. Sistema de Tradução — GUIA DE MANUTENÇÃO (passo a passo + exemplo de código real)
9. Guia de Setup Local (resumido, diferente do README — não duplicar e sim complementar)
10. Checklist de Produção (pontos críticos)
11. Qualidade e Testes (pytest / oxlint / typecheck / Playwright)
12. Convenções e Padrões (i18n: sempre t() + padrão de nomenclatura chaves + data usando formatDate do i18n + moeda formatBRL)

Requisitos adicionais:
- Usar links clickáveis no formato `file:///C:/salomCrm/...` para apontar para arquivos reais (facilitar navegação).
- Incluir pelo menos 1 exemplo REAL de como adicionar uma nova string traduzível (3 passos: 1) editar dicionário 3 idiomas, 2) importar useI18n no componente, 3) renderizar via `t()` + interpolação se necessário).
- NÃO sobrescrever README.md existente.

**Prioridade:** medium

**Depende de:** Tasks 1–12 (para ter a versão final da arquitetura do i18n documentada corretamente)

**Critérios de Aceitação pais:** AC-14 (rubrica 0-2 ≥1)

**Test Requirements (TRs):**
- **TR 13.1 (rule):** Arquivo `PROJECT_DOCS.md` existe na raiz e contém todas as 12 seções (checagem por heading ##).
- **TR 13.2 (rule):** Seção "Sistema de Tradução" contém 3 passos + exemplo de código (trecho `t("New feature", {param})` real ou pseudo-código realista).
- **TR 13.3 (rule):** Documento contém pelo menos 10 links clickáveis no formato `file:///`.
- **TR 13.4 (rubric 0-2 ≥1):** Qualidade/completude geral. ≥1 = ≥10 seções com informações corretas; guia prático utilizável. 2 = 12 seções perfeitas, links precisos com ranges de linha.

**Status:** pending

---

## Task 14: Smoke check visual de troca de idioma (verificação manual)

**Descrição:**
Levantar o frontend (`yarn dev`), logar com conta demo, navegar por:
1. /app (ClientsDashboard + KPI + table) → trocar idioma → verificar tradução.
2. /agenda → abrir modal novo appointment → verificar tradução.
3. /stylists → abrir modal novo stylist → verificar.
4. /servicos → abrir modal novo service → verificar (admin only).
5. Abrir drawer de cliente e timeline.
6. Testar archive client (ConfirmDialog com texto traduzido).
7. Fazer logout (Sidebar toast traduzido).
8. Em todas as etapas: nenhum layout quebrado por texto longo (especialmente es).

**Prioridade:** medium

**Depende de:** Tasks 1–13 concluídas.

**Critérios de Aceitação pais:** AC-15

**Test Requirements (TRs):**
- **TR 14.1 (rule):** Trocar para pt-BR no LanguageSwitcher sem F5 → todas as strings UI das 5 páginas aparecem em pt-BR.
- **TR 14.2 (rule):** Trocar para es → mesmo acima, todas em espanhol.
- **TR 14.3 (rubric 0-2 ≥1):** Nenhum overflow visual gritante. ≥1 = layout permanece utilizável, nenhum botão/texto cortado perigosamente. ≤2 telas com pequeno wrap. 2 = layout pixel-perfect em todos os 3 idiomas.

**Status:** pending

---

## Matriz AC ↔ Task

| AC | Tasks que cobrem |
|---|---|
| AC-01 | 2,3,4,5,6,7,8,9 (pontos 1-14 RF-01) |
| AC-02 | 10 |
| AC-03 | 11 |
| AC-04 | 1 |
| AC-05 | 1 |
| AC-06 | 1 |
| AC-07 | 11 |
| AC-08 | 12 |
| AC-09 | 12 |
| AC-10 | 12 |
| AC-11 | 12 |
| AC-12 | 2,3,4,5,6,7,8,9,10 (todas devem preservar data-testid) |
| AC-13 | 1 (dict inserções) |
| AC-14 | 13 |
| AC-15 | 14 |
