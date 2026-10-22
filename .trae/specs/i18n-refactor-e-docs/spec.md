# Especificação — Refatoração Completa do Sistema de Tradução (i18n) + Documentação do Projeto

## 1. Problema

O sistema de tradução do Atelier Salon CRM possui infraestrutura técnica (React Context + hook `useI18n()`, persistência em localStorage, formatDate via Intl, dicionário com pt-BR / en / es) **implementada e funcional para a área pública** (Login, Landing, Platform, Forgot/Reset Password e Sidebar/TopNav). Porém, **~70% das telas do workspace logado** (Módulos Clientes, Agenda, Estilistas, Serviços, Equipe, KPIs, Tabelas, Drawers, Modais e componentes compartilhados) **NÃO usam** o hook `useI18n()` — todas as suas strings (labels, placeholders, toasts, erros, paginação, botões, confirmações, estados vazios, status) estão hardcoded em inglês.

Resultado atual: ao usuário selecionar "Português (Brasil)" ou "Español" no LanguageSwitcher, a tradução se aplica apenas a ~30% da UI (áreas de autenticação e navegação). A área operacional do dia a dia do salão (Cadastro de clientes, Agenda, etc.) permanece 100% em inglês, independente do locale selecionado.

Adicionalmente:
- O dicionário de traduções em `frontend/src/lib/i18n.tsx` está **fragmentado em 7 blocos `Object.assign`** com **2 chaves duplicadas no pt-BR** e ~80 strings ausentes no espanhol (fallback para inglês via spread `...translations.en`).
- Muitas chaves já existem no dicionário (ex: `"Showing {from}–{to} of {total}"`) mas **nenhum componente as chama via `t()`**, ficando órfãs.
- O componente compartilhado `ConfirmDialog.tsx` tem `"Cancel"` e `"Removing…"` hardcoded.
- Ao final, não existe documentação consolidada do projeto (README cobre setup, mas não existe um documento de arquitetura/uso/manutenção/i18n).

## 2. Usuários e objetivos

### Usuários impactados
- **Usuários finais do CRM (donos de salão, administradores, equipe):** passam 95% do tempo nas telas do workspace. Hoje, trocar idioma não reflete na sua experiência operacional.
- **Equipe técnica (mantenedores do projeto):** sofrem com o dicionário fragmentado e sem validação de cobertura. Risco de duplicação e regressão.
- **Novos colaboradores / clientes do produto:** não têm documentação além do README (técnico / setup), sem guia de arquitetura, uso e manutenção de traduções.

### Objetivos
1. **Aplicar tradução a 100% da UI do workspace logado:** trocar para pt-BR ou es deve refletir em TODAS as telas (Clientes, Agenda, Estilistas, Serviços, Equipe, KPIs, Tables, Drawers, Modais, Confirmações, Toasts, Erros, Paginação, Empty States, Placeholders).
2. **Eliminar hardcoded em componentes compartilhados:** ConfirmDialog e utilitários compartilhados devem usar `t()`.
3. **Organizar o dicionário de traduções:** unificar em 3 objetos limpos (sem 7 blocos Object.assign separados), remover duplicações, completar strings faltantes no espanhol.
4. **Completar tradução do espanhol:** zero fallback para inglês no locale "es" — todas as chaves do pt-BR devem ter correspondente em es.
5. **Criar documentação do projeto consolidada:** arquivo único cobrindo arquitetura geral, stack, fluxos, domínios, modelos de dados, guia de como adicionar novas traduções e como adicionar novas páginas / componentes já com i18n.

### Não-objetivos (fora de escopo)
- **Não** criar novos recursos do CRM (apenas refatorar strings existentes).
- **Não** alterar comportamento funcional, lógica de negócio, ou dados do backend.
- **Não** alterar a infraestrutura técnica de i18n (Context API → não migrar para react-i18next / intl-extra).
- **Não** adicionar novos idiomas (3 suportados bastam: pt-BR, en, es).
- **Não** traduzir conteúdo do usuário/dados (nomes de clientes, nomes de serviços inseridos via seed/usuário, fórmulas capilares, anotações, tags).
- **Não** traduzir mensagens de erro do backend ou conteúdo enviado por e-mail (recuperação de senha).

## 3. Requisitos funcionais

### RF-01 — Adoção de `useI18n()` nos módulos do workspace
Cada página abaixo deve importar `useI18n`, extrair `const { t } = useI18n()` e substituir **TODAS as strings literais hardcoded** de UI por `t("chave")`:
1. `pages/ClientsDashboard.tsx` — SORT_OPTIONS, filterTabs labels, placeholders, search, sort, toasts, pagination, error state, buttons, confirm dialog title/description/confirmLabel
2. `pages/AgendaPage.tsx` — STATUS_META labels, toasts, error/empty/loading states, Today button, pagination, day title ("appointments" plural), ConfirmDialog title/description/confirmLabel, subtitle do AppShell
3. `pages/StylistsPage.tsx` — StylistCard (status "Active"/"Away", "client" pluralização), toasts, error/empty states, banner "Atelier · The floor", "The stylist roster", AppShell title/subtitle, ConfirmDialog strings
4. `pages/ServicesPage.tsx` — Table headers, status "Active"/"Inactive", "min" após duração, toasts, error/empty states, AppShell title/subtitle, ConfirmDialog strings
5. `pages/TeamPage.tsx` — AppShell title/subtitle, form fields ("Name", "E-mail", "Temporary password (10+ characters)", "Role", options "Team member"/"Administrator", button "Adding…"/"Add teammate", seção "Workspace access", erros, "Disable"/"Enable", option labels do select role
6. `components/dashboard/KpiStatCards.tsx` — 4 labels ("Total clients", "Active stylists", "Visits this month", "Recall due") e 4 hints ("in the book", "on the floor", "logged so far", "no visit in 8+ weeks")
7. `components/clients/ClientTable.tsx` — Headers ("Client", "Stylist", "Last visit", "Notes", "Actions"), "Unassigned", "No clients found" + descrição extended "Try another search…"
8. `components/clients/ClientDetailDrawer.tsx` — KIND_LABELS ("Visit log", "Formula", "Allergy alert", "General note"), toasts, loading states, drawer SheetDescription arquivado / cliente sem estilista, sections ("Contact", "Hair profile", "Type:", "Preferred stylist", "Last visit", "Notes & history", "Log today" / "Logging…", botão "Load older notes", "Loading history…", placeholders, mensagens "Select a client to see their history", "Born …", "Unassigned"
9. `components/clients/NotesTimeline.tsx` — KIND_META labels ("Visit", "Formula", "Allergy", "Note"), empty state "No notes yet — add the first one below."
10. `components/clients/ClientFormModal.tsx` — Modal title/description, form labels ("Name", "Phone", "E-mail", "Birthday", "Preferred stylist", "Hair type/texture", "Last visit", "Primary formula/allergies", "Tags (comma separated)"), toast success/error, "Unassigned" como fallback stylist, "A name is required", buttons "Save changes" / "Add client" / "Saving…" / "Cancel"
11. `components/agenda/AppointmentFormModal.tsx` — Modal title/description ("Edit appointment" / "New appointment"), form labels ("Client", "Service", "Professional", "Date", "Time", "Notes"), placeholders ("Pick a day", "Anything the team should know — optional"), option fallback "Choose a client", "Choose a service", "Unassigned", "Load more clients", "Loading clients…", toasts de sucesso/erro/validação ("Choose a client", "Choose a service", "Pick the date and time"), DialogFooter ("Cancel", "Saving…", "Save changes", "Book appointment")
12. `components/stylists/StylistFormModal.tsx` — COLOR_OPTIONS labels ("Terracotta", "Caramel", "Forest", "Ink blue", "Amber", "Rosewood"), title/description, form labels ("Name", "Specialty / title", "Tag colour", "Active on the floor"), toast success/error, "A name is required", buttons
13. `components/services/ServiceFormModal.tsx` — title/description, form labels ("Name", "Description", "Duration (min)", "Price (R$)", "Active — available for booking"), placeholder ("e.g. Signature Cut & Blow-Dry"), toast success/error, "A name is required", buttons
14. `components/shared/ConfirmDialog.tsx` — "Cancel" e "Removing…" hardcoded DEVEM ser substituídos por `t(...)` OU props recebidas de quem chama. Requisito: as strings não podem mais ser literais fixas no componente.

### RF-02 — Utilitários compartilhados traduzíveis
- `lib/format.ts` função `visitMeta()` atualmente retorna literais: "No visit logged", "Visited today", "Yesterday", "{days} days ago", "{weeks} week ago", "{weeks} weeks ago", "· recall due". Esta função NÃO tem acesso ao contexto React. Estratégia permitida (escolher UMA):
  - **Opção A (preferida):** transformar `visitMeta` para retornar **chaves i18n + valores** (ex: `{labelKey: "recall_weeks_ago", tone, params: {weeks: 8}}`) e o componente consumidor renderiza via `t(meta.labelKey, meta.params)`.
  - **Opção B:** criar um hook `useVisitMeta(days)` que envolve `visitMeta` e aplica `t()` internamente.
- `lib/format.ts` plural "client" / "clients" em StylistCard → usar `t(count === 1 ? "client" : "clients")`.

### RF-03 — Organização do dicionário `frontend/src/lib/i18n.tsx`
- Consolidar os 7 blocos `Object.assign` atualmente espalhados em **3 objetos literais limpos e contíguos**: `translations["pt-BR"] = {...}`; `translations.en = {...}`; `translations.es = {...}`.
- Remover 2 duplicações de chave no pt-BR: `"Welcome back, {name}"` (atualmente linhas 577 e 601) e `"Platform owner is not configured..."` (linhas 235 e 578). Manter o valor correto (mais recente).
- Completar a tradução do espanhol: **para cada chave existente no pt-BR**, adicionar a correspondente tradução em `translations.es` (hoje ~80 caem no fallback `...translations.en`).
- Manter a regra do locale "en" = chave como valor (fallback automático `Object.keys(ptBR).map(k→[k,k])`), **mas** manter overlays apenas quando a chave for pt-BR e precisar de en real.
- Adicionar no objeto pt-BR todas as **novas chaves** introduzidas pelo RF-01/RF-02 que ainda não existem.
- Adicionar no objeto en tradução explícita (overlay) para as chaves que antes não existiam e agora foram introduzidas (quando a chave não for o próprio texto en).
- **Interpolação:** preservar variáveis `{placeholder}` em todos os idiomas quando usadas.

### RF-04 — Sidebar toast fix
`components/layout/Sidebar.tsx` já importa `useI18n` mas seu toast `toast.success("Signed out — see you soon")` está hardcoded. Substituir por `t("Signed out — see you soon")` e adicionar a chave em pt-BR/en/es.

### RF-05 — Validação de builds
Após refatoração: `cd frontend && yarn typecheck` deve passar sem erros; `yarn build` deve compilar; `yarn lint` deve passar.

### RF-06 — Documentação do Projeto
Criar **1 arquivo markdown de documentação consolidada** (criar apenas se o usuário não vetar; local: `PROJECT_DOCS.md` na raiz, não sobrescrever README.md existente) contendo:

1. **1. Visão Geral do Produto** — nome final, propósito, público alvo, principais módulos.
2. **2. Arquitetura Geral** — diagrama textual (frontend SPA → API REST → MongoDB), padrão multi-tenant (shared DB, isolation por middleware + tenant_id), sessões httpOnly em Mongo.
3. **3. Stack tecnológica completa** — cada pacote/biblioteca com justificativa (backend FastAPI / Motor / Pydantic / Passlib-bcrypt; frontend React 19 / Vite / TypeScript / Tailwind v4 / shadcn/ui / TanStack Query / React Router / date-fns / Sonner / Framer Motion / Recharts; testes pytest + Playwright).
4. **4. Estrutura de pastas** — backend (lib, models, routers); frontend (pages, components/layout/shared/ui/*, lib); tests e2e.
5. **5. Modelo de Dados (MongoDB)** — descrição por coleção (tenants, platform_users, sessions, users, stylists, services, clients, notes, appointments) com campos chave + regras de negócio (soft delete via `active`, snapshot de service no appointment, last_visit carimbado por note kind=visit, bloqueio de overlap de horário).
6. **6. Autenticação e Autorização** — 3 níveis (Platform Owner / Tenant Admin / Tenant Staff), fluxo de login (slug + email + senha), cookie httpOnly `atelier_session`, recuperação de senha (SMTP + 30min + invalida sessões).
7. **7. Fluxos Principais (user journeys)** — Cadastro de Cliente → Agendamento → Conclusão (carimba visita e last_visit) → Anotações; Gestão de Equipe; Gestão de Tenants pelo Platform Owner.
8. **8. Sistema de Tradução (Guia de Manutenção)** — como adicionar uma nova string traduzível (3 passos: 1) adicionar chave/valor nos 3 dicionários; 2) no componente, `const { t } = useI18n()` e usar `t("Chave")`; 3) se tiver interpolação, passar `{variável}`); como adicionar um idioma novo; checagem manual de cobertura.
9. **9. Guia de Setup Local** — passo a passo resumido (Mongo, backend venv + seed + uvicorn, frontend yarn + vite, contas demo).
10. **10. Checklist de Produção** — pontos cruciais do README (APP_ENV=production, COOKIE_SECURE, CORS explícito, SMTP, migrate_tenants, health checks /health/live e /health/ready, VITE_WHATSAPP_NUMBER, secrets manager, build dist).
11. **11. Qualidade e Testes** — pytest backend (13 suites), oxlint / typecheck frontend, Playwright e2e.
12. **12. Convenções e padrões** — i18n: todas as novas strings devem ser passadas por `t()`, nunca literais em inglês/pt; pattern naming: chaves = frase em inglês (que serve de fallback en), exceto quando origem for pt-BR (então overlay explícito en); data/hora usar `formatDate` do useI18n, não `format()` de date-fns cru quando exibir para usuário final; valores monetários usar `formatBRL` ou Intl via locale.

## 4. Requisitos não funcionais

### RNF-01 — Sem regressão visual
Nenhuma string deve ser cortada ou overflowar layouts nos 3 idiomas (pt-BR, en, es). O idioma "es" tende a ser ~15-20% mais verboso; labels pequenas (ex: botões da tabela, chips de status) devem ser testadas mentalmente (usar traduções curtas, evitar truncagem inesperada).

### RNF-02 — Sem regressão de tipos
`yarn typecheck` deve passar com zero erros após a refatoração.

### RNF-03 — Build limpo
`yarn build` deve finalizar com sucesso e gerar bundle sem warnings relacionados às mudanças.

### RNF-04 — Sem quebra de data-testids
Nenhum `data-testid` existente pode ser renomeado ou removido (testes e2e dependem deles). Apenas adicionar quando necessário.

### RNF-05 — Dicionário tipado (opcional, bônus)
O tipo do parâmetro `text` da função `t()` atualmente é `string` → idealmente estreitar para `keyof typeof translations["pt-BR"]` para ter autocomplete + erro de compilação se a chave não existir. **Se não for viável sem quebrar usos existentes (chaves dinâmicas como `t(user.role === "admin" ? "Administrator" : "Team member")`)**, manter o tipo `string` e não criar risco.

### RNF-06 — Pluralização e formatação por locale
- Datas mostradas ao usuário devem usar `formatDate(date, options)` do hook `useI18n()`. A função `formatDate` em `lib/format.ts` (que usa date-fns locale hardcoded en) pode ser mantida para **chaves internas de query string** ou ordenação, mas **não para exibição final ao usuário**.
- Moeda BRL: manter `formatBRL` (Intl pt-BR currency) — valores de preço sempre em R$ é comportamento de negócio correto e esperado, não internacionalização.

### RNF-07 — Performance
A troca de idioma via LanguageSwitcher não deve causar re-renderizações em cascata excessivas (memoização já existente via `useMemo` no provider — manter).

## 5. Restrições, dependências, premissas e questões em aberto

### Restrições
- **Não remover** a convenção de chaves em inglês servem de fallback para o locale en (estratégia atual funcionando).
- **Nenhum comportamento funcional** pode ser alterado: mesma validação, mesmos erros, mesmos toasts em termos de gatilho — apenas seu texto passa por `t()`.
- **Não traduzir conteúdo de usuário** (nomes de clientes, serviços, anotações, fórmulas). Apenas UI.
- `data-testid` são sagrados — nunca mudar.

### Dependências
- Nenhuma nova dependência npm a ser instalada (usar infra existente).
- Requer que o MongoDB e backend funcionem (não precisa estar rodando para build/typecheck, mas para verificação manual de telas precisa).

### Premissas
- Todas as strings hardcoded em inglês identificadas na análise prévia são **corretas semanticamente** — serão usadas como chave do dicionário (en).
- Tradução pt-BR e es: usar termos de salão de beleza usuais no Brasil e Espanha/LatAm. Se houver ambiguidade, optar pelo termo mais comum no setor.
- O usuário aceita o documento de documentação em **PORTUGUÊS (Brasil)**, conforme idioma do pedido.

### Questões em aberto resolvidas (decisões de design do especificador)
- **Q:** Onde colocar a documentação consolidada? **R:** `PROJECT_DOCS.md` na raiz do monorepo (mesmo nível que README.md), **não substitui** o README.md existente (README continua focado em setup rápido + produção).
- **Q:** `formatDate` de `lib/format.ts` vs `useI18n().formatDate`? **R:** manter ambos — o de `lib/format` para operações internas e fallback; o do `useI18n` para renderização ao usuário onde há contexto React.
- **Q:** ConfirmDialog strings via props ou via `t()` interno? **R:** Usar props opcionais com defaults via `t()`. Ex: `cancelLabel?: string` default = `undefined`, componente usa `cancelLabel ?? t("Cancel")`. Assim, mantemos flexibilidade para casos específicos mas não requeremos prop em todas as chamadas.

## 6. Critérios de Aceitação (ACs)

Tipo = `rule` (binário, verificável objetivamente) ou `rubric` (avaliativo com escala).

### AC-01 — rule
**Cada arquivo da lista RF-01 (14 arquivos) importa `useI18n` e nenhuma string literal de UI visível ao usuário permanece hardcoded em inglês/pt direto no JSX/literal.**
Verificação: grep manual em cada um dos 14 arquivos por padrões típicos de string hardcoded UI (ex: `"New client"`, `"Add client"`, `"Search name"`, `"Scheduled"`, `"Active"`, `"Try again"`, `"Showing "`, `"No clients"`, toast.success/error strings) — deve encontrar 0 ocorrências de strings que existem como chave no dicionário. Exceção permitida: `data-testid`, `className` strings, comentários, valores de URL, keys de dicionário usadas como valor default para en.

### AC-02 — rule
**`ConfirmDialog.tsx` não possui mais `"Cancel"` nem `"Removing…"` como literais fixas.**
Verificação: leitura do arquivo — ambas as strings devem ser ou `t(...)` ou props parametrizadas com default via `t(...)`.

### AC-03 — rule
**Sidebar toast de logout usa `t()`.**
Verificação: em Sidebar.tsx `handleLogout` → `toast.success(t(...))`.

### AC-04 — rule
**Dicionário consolidado em 3 blocos limpos (pt-BR, en, es) + 0 duplicações de chave em pt-BR.**
Verificação: `Object.keys(translations["pt-BR"]).length === new Set([...keys]).size` (sem duplicatas), e estrutura do arquivo são 3 objetos literais consecutivos, no máximo 1 `Object.assign` por idioma apenas para overlays en de chaves pt-BR.

### AC-05 — rule
**Cobertura de tradução espanhol = 100%.**
Verificação: `Object.keys(translations["pt-BR"]).every(k => k in translations.es)` → `true`. Nenhuma chave de pt-BR ausente no es.

### AC-06 — rule
**Interpolações preservadas:** strings com `{placeholder}` tem o placeholder em pt-BR, en e es (mesmo nome de chave entre chaves).
Verificação: encontrar todas as chaves com "{" no valor pt-BR e validar que mesmo nome de variável existe em en e es.

### AC-07 — rule
**`visitMeta` não retorna mais literais de texto diretamente.**
Verificação: leitura de `lib/format.ts`. Opção A ou B aplicada.

### AC-08 — rule
**`yarn typecheck` passa com 0 erros após a refatoração.**
Evidência: saída do comando.

### AC-09 — rule
**`yarn build` (frontend) termina com sucesso e exit code 0.**
Evidência: saída do comando.

### AC-10 — rule
**`yarn lint` (frontend) passa com 0 erros.**
Evidência: saída do comando.

### AC-11 — rule
**Backend tests não regrediram.**
Evidência: `cd backend && python -m pytest` exit code 0 (não há mudanças no backend então deve continuar passando).

### AC-12 — rule
**Nenhum `data-testid` existente foi renomeado ou removido em nenhum arquivo frontend.**
Verificação: diff comparando todos os atributos `data-testid="..."` antes e depois.

### AC-13 — rubric (escala 0–2; threshold ≥ 1)
**Qualidade das traduções pt-BR e es no domínio "salão de beleza":**
- **2 (excelente):** 100% das traduções usam terminologia padrão do setor (ex: "atendimento" para appointment, "profissional" para stylist, "retorno/rechamada" para recall, "carteira de clientes" para client book, "catálogo" para menu de services, "anotação" para note, "fórmula" para formula). Nenhum anglicismo ou calque inadequado. Plurais e gênero gramaticais corretos (pt-BR: "cliente arquivado" não "cliente arquivada" genérico; es: concordancia adecuada).
- **1 (aceitável, mínimo para passar):** ≥ 90% adequado; até 3 traduções soam "literais" mas são compreensíveis por operador de salão. Nenhuma inversão de significado.
- **0 (insuficiente, reprova):** > 3 traduções confusas / inversão de sentido / anglicismos que quebram UX.

### AC-14 — rubric (escala 0–2; threshold ≥ 1)
**Qualidade e completude da documentação `PROJECT_DOCS.md`:**
- **2 (excelente):** Documento contém todas as 12 seções pedidas no RF-06, com informações corretas (compatíveis com codebase real), links clicáveis para arquivos (padrão `file:///path/to/file.ext#Lstart-Lend`), código de exemplo para guia de tradução (exemplo real de componente com `useI18n` + chave nos 3 dicionários), diagramas textuais que comunicam arquitetura com clareza.
- **1 (aceitável, mínimo para passar):** ≥ 10/12 seções presentes, informações majoritariamente corretas, pelo menos o guia de como adicionar novas traduções tem passos práticos e um exemplo funcional.
- **0 (insuficiente, reprova):** < 10 seções, ou informações factualmente erradas (ex: afirma que usa Postgres quando é Mongo, ou roles erradas), ou guia de i18n ausente.

### AC-15 — rule
**Trocar idioma no LanguageSwitcher reflete em TELAS do workspace (ClientsDashboard, Agenda, Stylists, Services, KPIs) imediatamente, sem refresh.**
Verificação: rodar frontend dev, logar, abrir ClientsDashboard → trocar para pt-BR → todas as labels passar para pt-BR sem F5; trocar para es → idem.
