# Atelier — documentação do sistema

Este manual descreve o funcionamento atual do Atelier Salon CRM: arquitetura,
funcionalidades, permissões, instalação, configuração, API, dados, testes e operação.
Foi escrito a partir do código deste repositório. Onde uma decisão operacional depende
do ambiente ou de um provedor, isso é indicado explicitamente.

## Índice

1. [Visão geral](#visão-geral)
2. [Funcionalidades e telas](#funcionalidades-e-telas)
3. [Perfis e permissões](#perfis-e-permissões)
4. [Arquitetura](#arquitetura)
5. [Pré-requisitos e execução local](#pré-requisitos-e-execução-local)
6. [Configuração](#configuração)
7. [Dados e regras de negócio](#dados-e-regras-de-negócio)
8. [Referência da API](#referência-da-api)
9. [Testes e verificações](#testes-e-verificações)
10. [Build e implantação](#build-e-implantação)
11. [Manutenção e solução de problemas](#manutenção-e-solução-de-problemas)

## Visão geral

O Atelier é um CRM web para salões de beleza. Centraliza cadastro e histórico de
clientes, agenda, profissionais, catálogo de serviços e contas da equipe. A aplicação
suporta vários salões em uma instalação: os dados dos salões ficam em coleções
compartilhadas do MongoDB, sempre separados pelo identificador do espaço (`tenant_id`).

| Camada | Tecnologia |
|---|---|
| Interface | React 19, TypeScript, Vite, React Router, TanStack Query e Tailwind CSS |
| Componentes | Base UI, componentes locais no padrão shadcn/ui e ícones Lucide |
| API | Python, FastAPI, Pydantic v2 e Motor/PyMongo |
| Banco | MongoDB |
| Sessão | Cookies `httpOnly`; a API mantém os registros de sessão no MongoDB |
| Idiomas da interface | Português do Brasil, inglês e espanhol |

A interface de desenvolvimento fica em `http://localhost:3000`; a API fica em
`http://localhost:8001`, com rotas de negócio sob `/api`.

## Funcionalidades e telas

### Site público e acesso

- `/`: página pública com apresentação dos benefícios e recursos, idioma selecionável
  e acesso ao login.
- `/agendar/{slug}`: página pública de reserva do salão, se o agendamento online estiver
  ativado. O cliente escolhe serviço, profissional (ou qualquer profissional disponível),
  data e horário, informa nome/telefone e recebe confirmação imediata. Exibe a
  identidade visual do salão.
- `/login`: autenticação de funcionário/administrador de salão usando identificador
  do espaço, e-mail e senha.
- `/platform/login`: modo separado de autenticação do administrador da plataforma.
- `/forgot-password`: solicitação de redefinição para conta de salão ou da plataforma.
- `/reset-password`: definição de uma nova senha usando o token recebido por e-mail.
- Depois de entrar, a rota raiz encaminha usuários autenticados para `/app`.

Os botões comerciais podem abrir uma conversa no WhatsApp quando
`VITE_WHATSAPP_NUMBER` estiver configurado. Sem esse número, a página mostra o aviso
de atendimento comercial ainda não configurado.

### Clientes — `/app`

- Indicadores: clientes ativos, profissionais ativos, visitas no mês, retornos
  pendentes e clientes sem profissional.
- Busca no servidor por nome, telefone, e-mail, fórmula, tipo de cabelo e etiquetas.
- Filtros por profissional, incluindo clientes sem atribuição; ordenação por nome ou
  data da visita; opção para consultar clientes arquivados.
- Cadastro com contatos, aniversário, profissional preferido, tipo de cabelo,
  fórmula, etiquetas e data da última visita.
- Painel de detalhes com histórico, perfil capilar, alteração do profissional,
  anotações e registro de visita.
- Arquivar e restaurar clientes não apaga o histórico nem as anotações.

### Agenda — `/agenda`

- Navegação por semana e por dia; “Hoje” usa a data fornecida pela API para o salão.
- Lista de agendamentos do dia com cliente, serviço, horário, profissional, valor e
  situação.
- Criação e edição com seleção de cliente, serviço, profissional, data, horário e notas.
- O profissional preferido do cliente é sugerido ao selecionar esse cliente.
- Agendamentos podem ser concluídos ou cancelados; administradores também podem
  removê-los.
- Concluir registra uma visita no histórico do cliente e atualiza sua última visita.
- Os administradores configuram em `/booking-settings` o horário do salão e a escala
  semanal de cada profissional; somente horários compatíveis são oferecidos no link
  público. Os horários são exibidos em intervalos de 30 minutos e a antecedência máxima
  é de 30 dias.
- Em `/branding`, o administrador altera o nome exibido, o logotipo e as cores
  principal/de destaque do próprio salão. PNG, JPEG e WebP são aceitos até 2 MB. A
  identidade é aplicada ao painel do salão e ao agendamento público, não à tela de login.

### Profissionais — `/stylists`

- Lista de profissionais com especialidade, cor, disponibilidade e quantidade de
  clientes atribuídos.
- Administradores podem cadastrar, editar e arquivar profissionais; demais membros
  consultam a lista.
- Arquivar não remove o registro histórico e desatribui os clientes desse profissional.

### Serviços — `/servicos`

- Catálogo com nome, descrição, duração, preço e disponibilidade para agendamento.
- Administradores podem cadastrar, editar e arquivar serviços.
- A equipe consulta o catálogo. O arquivamento não altera os dados já guardados em
  agendamentos existentes.

### Equipe — `/team`

- Exclusivo para administradores do salão.
- Consulta, criação e atualização de contas; na criação, define nome, e-mail, senha
  inicial e papel `admin` ou `staff`.
- É possível alterar o papel e ativar/desativar outra conta.
- O backend impede desativar ou rebaixar o último administrador ativo do espaço.

### Administração da plataforma — `/platform`

- Exclusiva para o administrador da plataforma.
- Consulta e pesquisa de espaços, criação de salão junto com a primeira conta
  administradora e ativação/desativação dos espaços não padrão.
- O espaço padrão não pode ser desativado.
- A conta da plataforma não representa nem assume a identidade de usuários do salão.
  Para entrar em um salão, o operador usa o login normal daquele espaço.
- A tela inclui alteração de senha da conta da plataforma.

## Perfis e permissões

Todas as rotas de dados do salão exigem uma sessão válida do próprio espaço. A
permissão é novamente verificada no backend; ocultar um botão na interface não é o
controle de acesso.

| Ação | `staff` | `admin` do salão | Administrador da plataforma |
|---|:---:|:---:|:---:|
| Consultar clientes, anotações, agenda, profissionais e serviços | Sim | Sim | Não por meio da conta da plataforma |
| Criar/editar clientes, anotações e agendamentos | Sim | Sim | Não |
| Concluir ou cancelar agendamento | Sim | Sim | Não |
| Remover agendamento | Não | Sim | Não |
| Criar/editar/arquivar profissionais | Não | Sim | Não |
| Criar/editar/arquivar serviços | Não | Sim | Não |
| Gerenciar contas da equipe do salão | Não | Sim | Não |
| Configurar agendamento online | Não | Sim | Não |
| Alterar nome e identidade visual do salão | Não | Sim | Não |
| Criar/ativar/desativar espaços | Não | Não | Sim |
| Alterar a própria senha master | Não | Não | Sim |

O usuário de salão entra com slug, e-mail e senha. O acesso da plataforma usa
e-mail e senha próprios e uma sessão/cookie separado.

## Arquitetura

```text
Navegador
  └─ React/Vite em :3000
       ├─ interface SPA e rotas de página
       └─ /api/* ── proxy Vite em desenvolvimento ──> FastAPI em :8001
                                                      └─ MongoDB
```

- `frontend/src/App.tsx`: rotas; cada página é carregada sob demanda.
- `frontend/src/pages/`: telas de clientes, agenda, profissionais, serviços, equipe,
  acesso, recuperação de senha e administração da plataforma.
- `frontend/src/components/`: componentes reutilizados e formulários.
- `frontend/src/lib/api.ts`: cliente HTTP tipado; usa o prefixo relativo `/api` e
  deixa o navegador enviar cookies automaticamente.
- `frontend/src/lib/i18n.tsx` e `frontend/src/lib/I18nProvider.tsx`: dicionários,
  contexto, seleção de idioma e formatação de data.
- `frontend/src/lib/types.ts`: contratos TypeScript que espelham os modelos Pydantic.
- `frontend/vite.config.ts`: porta `3000`, proxy `/api` para `http://localhost:8001`
  (ou `API_PROXY_TARGET`) e build Vite.
- `backend/server.py`: inicialização FastAPI, middlewares, montagem de rotas, health
  checks, validação de configuração e inicialização de índices/espaço padrão.
- `backend/routers/`: rotas HTTP de autenticação, plataforma/equipe, dados do salão,
  serviços e agenda.
- `backend/models/`: validação e serialização de pedidos/respostas.
- `backend/lib/db.py`: conexão MongoDB, índices e adaptador que limita coleções de
  salão pelo tenant ativo.
- `backend/lib/tenancy.py`: obtém a sessão do cookie e estabelece o contexto isolado
  do espaço durante a requisição.
- `backend/tests/`: testes de API. `tests/e2e/`: testes Playwright.

FastAPI expõe o esquema OpenAPI e a interface Swagger em `/docs` enquanto a API
estiver acessível.

## Pré-requisitos e execução local

Pré-requisitos: Python 3.11 ou superior, Node.js compatível com Vite 8, Yarn, e um
MongoDB acessível. Na infraestrutura de desenvolvimento deste projeto, o backend usa
`8001` e o Vite usa `3000`.

### 1. Configurar o backend

No PowerShell, a partir da raiz do repositório:

```powershell
cd C:\salomCrm\backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edite `backend/.env` e, no mínimo, configure `MONGO_URL` e `DB_NAME` para apontar
para seu MongoDB. O arquivo `.env.example` contém os nomes das variáveis e exemplos
de configuração; credenciais reais não devem ser commitadas.

Opcionalmente inicialize os dados locais de demonstração:

```powershell
python seed.py
```

O seed é idempotente e inclui usuários, profissionais, serviços, clientes, anotações
e agendamentos de exemplo. Em desenvolvimento local, as credenciais definidas no
seed são:

| Conta | E-mail | Senha | Papel |
|---|---|---|---|
| Administrador do salão | `admin@atelier.com` | `atelier123` | `admin` |
| Pessoa da equipe | `marina@atelier.com` | `atelier123` | `staff` |

Essas credenciais são somente para desenvolvimento; nunca as use em produção.

Inicie a API, mantendo o ambiente virtual ativo:

```powershell
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### 2. Configurar e iniciar o frontend

Em outro terminal:

```powershell
cd C:\salomCrm\frontend
yarn install
yarn dev
```

O frontend responde em `http://localhost:3000`. O proxy Vite encaminha chamadas
`/api/*` para o backend em `http://localhost:8001`. Para apontar a outro endereço
durante o desenvolvimento, configure `API_PROXY_TARGET` no ambiente do processo do
Vite. Reinicie o servidor após alterar variáveis de ambiente.

Instalar dependências pelo npm também é possível (`npm install`); o repositório mantém
`yarn.lock`, portanto Yarn é o caminho preferido para instalações reproduzíveis.

### 3. Encerrar os processos

Interrompa cada servidor no terminal correspondente com `Ctrl+C`. O frontend e o
backend são processos independentes; iniciar o Vite sem a API deixa a interface
disponível, mas as operações de dados falham.

## Configuração

### Backend — `backend/.env`

| Variável | Obrigatória | Descrição |
|---|---|---|
| `MONGO_URL` | Sim* | URI de conexão MongoDB. Também aceita-se `MONGODB_URI`. |
| `DB_NAME` | Sim* | Banco de dados; se omitido, é lido do caminho da URI MongoDB. |
| `MONGODB_USERNAME` / `MONGODB_PASSWORD` | Condicional | Usados juntos se o usuário/senha não estiverem na URI. |
| `APP_ENV` | Não | `development` (padrão), `staging` ou `production`. |
| `DEFAULT_TENANT_SLUG` | Recomendado | Slug do espaço padrão; fallback local usa `DB_NAME`. |
| `CORS_ORIGINS` | Não | Origens permitidas separadas por vírgulas; padrão de desenvolvimento: `http://localhost:3000`. Não aceita `*` com credenciais. |
| `COOKIE_SECURE` | Não | `true` exige cookie seguro HTTPS; por padrão fica ligado em produção e desligado em desenvolvimento. |
| `RATE_LIMIT_SECRET` | Produção | Segredo aleatório com pelo menos 32 caracteres para derivar identificadores não reversíveis das janelas de limite de autenticação. |
| `TRUSTED_PROXY_IPS` | Condicional | IPs/CIDRs dos proxies reversos confiáveis, separados por vírgula. Só esses proxies podem fornecer `X-Forwarded-For` para identificar o cliente nos limites de autenticação. |
| `PLATFORM_OWNER_EMAIL` | Opcional em desenvolvimento; obrigatório em produção | E-mail inicial da conta administradora da plataforma. |
| `PLATFORM_OWNER_PASSWORD` | Opcional em desenvolvimento; obrigatório em produção | Senha master inicial; mínimo 16 caracteres em produção. |
| `PLATFORM_OWNER_NAME` | Não | Nome da conta da plataforma; padrão `Platform Owner`. |
| `PUBLIC_APP_URL` | Produção | Origem HTTPS pública do frontend, sem caminho, query ou fragmento; usada nos links de redefinição. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM_EMAIL` | Produção | Servidor, porta e remetente para envio de recuperação de senha. Porta padrão do código de envio: `587`. |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | Opcional | Credenciais SMTP; configure as duas ou nenhuma. |

*É obrigatório configurar `MONGO_URL` ou `MONGODB_URI` e uma fonte para o nome do
banco. Não coloque segredos no código ou em variáveis `VITE_*`, pois estas podem ser
embutidas no bundle do navegador.

Em produção a inicialização falha se faltarem requisitos: `APP_ENV=production`,
senha master de pelo menos 16 caracteres, `COOKIE_SECURE=true`, origens CORS HTTPS
explícitas, MongoDB remoto autenticado com TLS, `DEFAULT_TENANT_SLUG` e configuração
HTTPS/SMTP para recuperação de senha, e `RATE_LIMIT_SECRET` com pelo menos 32
caracteres.

Login do salão e da plataforma são limitados a 20 tentativas por IP a cada 15 minutos;
solicitações de recuperação são limitadas a 5 por hora e redefinições a 10 por hora.
Os contadores ficam no MongoDB compartilhado entre instâncias e são removidos por
índice TTL. O limite usa o endereço de conexão direto, a menos que o proxy esteja
explicitamente listado em `TRUSTED_PROXY_IPS`; nunca confie em `X-Forwarded-For`
enviado diretamente por clientes.

Requisições de alteração autenticadas por cookie precisam enviar `Origin` ou
`Referer` correspondente a uma origem configurada em `CORS_ORIGINS`. Navegadores
fazem isso automaticamente; clientes HTTP próprios que reutilizam cookies precisam
enviar um desses cabeçalhos.

### Frontend

| Variável | Uso |
|---|---|
| `API_PROXY_TARGET` | Variável do processo Vite para substituir o destino local do proxy `/api` em desenvolvimento; padrão `http://localhost:8001`. |
| `VITE_DEFAULT_TENANT_SLUG` | Prefill opcional do slug do salão na tela de login. |
| `VITE_WHATSAPP_NUMBER` | Número comercial, apenas dígitos e com código do país/DDD; habilita links de contato no WhatsApp. |

As variáveis `VITE_*` são públicas, não devem conter senhas, tokens ou credenciais.

## Dados e regras de negócio

Os identificadores de registros são strings UUID (o seed de desenvolvimento usa IDs
fixos). Os registros abaixo pertencem a um salão salvo indicação em contrário.

| Coleção/modelo | Campos principais | Observações |
|---|---|---|
| `tenants` | `id`, `name`, `slug`, `active`, `created_at` | Slug único; contém os espaços/salões. |
| `platform_users` | `id`, `name`, `email`, `password_hash`, `active` | Administrador master; coleção separada das contas de salão. |
| `platform_sessions` | `token`, `user_id`, `created_at`, `expires_at` | Sessões exclusivas da plataforma. |
| `users` | `id`, `tenant_id`, `name`, `email`, `role`, `active`, `password_hash`, `created_at` | E-mail único dentro de cada tenant; papel `admin` ou `staff`. |
| `sessions` | `token`, `tenant_id`, `user_id`, `created_at`, `expires_at` | Cookie de sessão do salão, duração de 30 dias. |
| `clients` | `id`, `name`, `email`, `phone`, `birthday`, `stylist_id`, `hair_type`, `last_visit`, `formula`, `tags`, `active`, `created_at` | Datas de cliente usam `YYYY-MM-DD`; arquivo lógico usa `active=false`. |
| `stylists` | `id`, `name`, `title`, `color`, `avatar_url`, `active`, `created_at` | Arquivamento usa `active=false`. |
| `services` | `id`, `name`, `description`, `duration_min`, `price`, `active`, `created_at` | Valores em BRL na interface; duração em minutos. |
| `appointments` | `id`, IDs de cliente/profissional/serviço, `date`, `time`, `notes`, `status`, preço/duração snapshot, `created_by`, `created_at` | Estado: `scheduled`, `completed` ou `cancelled`. |
| `notes` | `id`, `client_id`, `kind`, `body`, `created_at`, `appointment_id` opcional | Tipo: `visit`, `formula`, `allergy` ou `general`. |

### Regras importantes

- Os documentos de salão carregam `tenant_id`. O middleware usa o cookie
  `atelier_session` para estabelecer o tenant da requisição. O adaptador Mongo injeta
  o filtro de tenant em consultas, atualizações, contagens, exclusões e agregações.
- Senhas são armazenadas como hashes `pbkdf2_sha256`, não em texto simples. Os cookies
  `atelier_session` e `atelier_platform_session` são `httpOnly`, `SameSite=Lax` e
  expiram após 30 dias; `Secure` depende do ambiente/configuração.
- O proprietário master é criado/sincronizado no startup se as duas variáveis
  `PLATFORM_OWNER_EMAIL` e `PLATFORM_OWNER_PASSWORD` estiverem definidas. Sua senha só
  é inicializada quando a conta é criada pela primeira vez; mudanças posteriores são
  feitas pelo fluxo de alteração/recuperação de senha.
- Contas de salão exigem senha inicial com pelo menos 10 caracteres. Na recuperação,
  o token é de uso único e expira em 30 minutos; redefinir a senha encerra as sessões
  existentes dessa conta.
- Clientes, profissionais e serviços são arquivados logicamente em vez de apagados.
  Clientes arquivados deixam a lista ativa; a API permite restaurar por
  `PUT /clients/{id}` com `active: true`.
- Arquivar um profissional limpa a atribuição dos clientes, preservando o histórico.
  Serviços e profissionais arquivados não podem ser selecionados em novos
  agendamentos, mas referências históricas continuam visíveis.
- O preço e a duração de um serviço são copiados para o agendamento na criação.
  Alterar o preço/duração do catálogo depois não muda esses snapshots.
- Agendamentos com profissional não podem sobrepor outro agendamento não cancelado
  desse profissional. A API aplica locks curtos por profissional/dia para serializar
  alterações concorrentes. Agendamentos sem profissional não reservam agenda de
  profissional. O agendamento deve terminar antes da meia-noite.
- A reserva pública exige recurso ativado, serviço ativo e interseção dos horários do
  salão e do profissional. A API recalcula disponibilidade dentro de locks por
  profissional/dia antes de gravar, limita reservas públicas por IP e associa o
  agendamento ao cadastro ativo com telefone normalizado ou cria o cadastro do cliente.
- Reservas públicas só podem ser feitas para hoje ou até 30 dias à frente. Elas são
  confirmadas imediatamente; não há fluxo público de alteração/cancelamento nem envio
  automático de notificação nesta versão.
- Concluir uma reserva cria no máximo uma anotação de visita. A última visita do
  cliente não retrocede; visitas futuras não avançam a data para além de hoje.
- O indicador de retorno usa o limite de 56 dias (oito semanas), incluindo clientes
  sem visita registrada. As métricas contam visitas a partir das anotações do tipo
  `visit` criadas no mês corrente.
- Listagens de clientes, agendamentos e anotações aceitam paginação. Com `page`
  definido, a resposta tem `{ "items": [], "total": 0, "page": 1, "page_size": 50 }`.
  Sem `page`, clientes/agendamentos/notas mantêm resposta de lista simples.

## Referência da API

Prefixo: `/api`. JSON é usado nos corpos e respostas. As respostas protegidas recebem
os cookies de sessão automaticamente pelo navegador; não se envia token de sessão em
JSON ou em cabeçalho `Authorization`.

### Saúde e documentação

| Método e rota | Acesso | Descrição |
|---|---|---|
| `GET /health/live` | Público | Processo respondendo (`{"status":"ok"}`). |
| `GET /health/ready` | Público | Verifica startup, conexão com MongoDB e tenant padrão ativo; retorna 503 se indisponível. |
| `GET /api/` | Público | Identificação da API. |
| `GET /docs` | Público | Swagger/OpenAPI do FastAPI. |

### Autenticação e recuperação

| Método e rota | Acesso | Descrição |
|---|---|---|
| `POST /api/auth/login` | Público | Recebe `{ "tenant_slug": "salao", "email": "pessoa@exemplo.com", "password": "..." }`; grava cookie de salão. |
| `POST /api/auth/logout` | Sessão de salão | Invalida a sessão atual e limpa cookie. |
| `GET /api/auth/me` | Sessão de salão | Retorna perfil público, papel e slug do tenant. |
| `POST /api/auth/password/forgot` | Público | Recebe e-mail, `account_type` (`tenant`/`platform`) e slug para conta tenant; solicita link de recuperação. |
| `POST /api/auth/password/reset` | Público | Recebe `{ "token": "...", "password": "mínimo 10 caracteres" }`; consome o token de uso único. |
| `POST /api/platform/auth/login` | Público | Login master por e-mail/senha; grava cookie de plataforma. |
| `POST /api/platform/auth/logout` | Sessão master | Invalida a sessão master atual. |
| `GET /api/platform/auth/me` | Administrador master | Retorna o perfil master. |
| `POST /api/platform/auth/password` | Administrador master | Altera senha com `current_password` e `new_password` (10–128 caracteres). |

### Plataforma e equipe

| Método e rota | Acesso | Descrição |
|---|---|---|
| `GET /api/platform/tenants` | Administrador master | Lista os espaços, mais recentes primeiro. |
| `POST /api/platform/tenants` | Administrador master | Cria salão e primeiro admin; recebe `name`, `slug`, `admin_name`, `admin_email`, `admin_password`. Slug: 2–48 caracteres, minúsculos, números e hífen. |
| `PATCH /api/platform/tenants/{tenant_id}` | Administrador master | Altera `active`; tenant padrão não pode ser desativado. |
| `GET /api/team/users` | Admin do salão | Lista contas do espaço. |
| `POST /api/team/users` | Admin do salão | Cria membro; recebe `name`, `email`, `password` (mínimo 10) e `role` (`admin`/`staff`). |
| `PATCH /api/team/users/{user_id}` | Admin do salão | Atualiza `role` e/ou `active`; o tenant precisa manter pelo menos um administrador ativo. |

### CRM, serviços e agenda

| Método e rota | Acesso | Parâmetros/descrição |
|---|---|---|
| `GET /api/stylists` | Usuário do salão | Lista profissionais por nome. |
| `POST /api/stylists` | Admin do salão | Cria profissional. |
| `PUT /api/stylists/{stylist_id}` | Admin do salão | Atualiza campos enviados. |
| `DELETE /api/stylists/{stylist_id}` | Admin do salão | Arquiva e desatribui clientes. |
| `GET /api/clients` | Usuário do salão | Filtros: `search`, `stylist_id` (`none` significa sem atribuição), `sort_by` (`name`, `last_visit_asc`, `last_visit_desc`), `archived`, `page`, `page_size` (1–100). |
| `POST /api/clients` | Usuário do salão | Cria cliente. |
| `GET /api/clients/{client_id}` | Usuário do salão | Busca perfil do cliente. |
| `PUT /api/clients/{client_id}` | Usuário do salão | Atualiza campos; também restaura com `active: true`. |
| `DELETE /api/clients/{client_id}` | Usuário do salão | Arquiva cliente. |
| `GET /api/clients/{client_id}/notes` | Usuário do salão | Histórico em ordem decrescente; `page`, `page_size` (1–100). |
| `POST /api/clients/{client_id}/notes` | Usuário do salão | Cria anotação. Campo `kind` aceita `visit`, `formula`, `allergy`, `general`; visita pode receber `visit_date`. |
| `GET /api/services` | Usuário do salão | Lista catálogo. |
| `POST /api/services` | Admin do salão | Cria serviço. |
| `PUT /api/services/{service_id}` | Admin do salão | Atualiza campos enviados. |
| `DELETE /api/services/{service_id}` | Admin do salão | Arquiva serviço. |
| `GET /api/appointments` | Usuário do salão | Filtros: `date` ou `from_date`/`to_date`, `client_id`, `stylist_id`, `status`, `page`, `page_size` (1–100). Ordena por data e hora. |
| `POST /api/appointments` | Usuário do salão | Cria agendamento com cliente, serviço, profissional opcional, data, hora e notas. |
| `PUT /api/appointments/{appointment_id}` | Usuário do salão | Edita campos; verifica conflitos quando a agenda muda. |
| `POST /api/appointments/{appointment_id}/complete` | Usuário do salão | Conclui e registra visita idempotente. |
| `POST /api/appointments/{appointment_id}/cancel` | Usuário do salão | Cancela; reserva cancelada não bloqueia horário. |
| `DELETE /api/appointments/{appointment_id}` | Admin do salão | Remove agendamento. |
| `GET /api/stats` | Usuário do salão | Retorna data do salão, clientes, profissionais, visitas no mês, retornos, sem atribuição e arquivados. |

### Agendamento online

| Método e rota | Acesso | Parâmetros/descrição |
|---|---|---|
| `GET /api/booking/settings` | Admin do salão | Lê ativação, horário semanal do salão e horários semanais por profissional ativo. |
| `PUT /api/booking/settings` | Admin do salão | Salva a ativação e as janelas semanais; para ativar, exige horários coincidentes e ao menos um serviço ativo. |
| `GET /api/booking/public/{slug}` | Público | Retorna o nome do salão e o catálogo ativo de serviços/profissionais, sem dados de clientes. |
| `GET /api/booking/public/{slug}/availability` | Público | Recebe `date`, `service_id` e opcionalmente `stylist_id`; retorna horários livres por profissional. |
| `POST /api/booking/public/{slug}/appointments` | Público | Recebe nome, telefone, serviço, profissional opcional, data e horário; cria cliente se necessário e confirma a reserva. Limite: 10 requisições por IP por hora. |

### Identidade visual

| Método e rota | Acesso | Parâmetros/descrição |
|---|---|---|
| `GET /api/branding` | Usuário do salão | Retorna o nome público, logo e cores daquele espaço. |
| `PUT /api/branding` | Admin do salão | Altera nome, logo PNG/JPEG/WebP (até 2 MB) e cores hexadecimais `#RRGGBB`. |

Os corpos completos e restrições dos modelos ficam em `backend/models/`; os tipos
correspondentes ficam em `frontend/src/lib/types.ts`. Erros de autenticação/autorização
costumam resultar em HTTP 401/403; ausência de recurso em 404; conflitos de estado ou
agenda em 409; validação Pydantic em 422.

## Testes e verificações

### Frontend

Na pasta `frontend`:

```powershell
yarn typecheck
yarn lint
yarn build
```

`npm run` oferece os mesmos scripts: `typecheck`, `lint` e `build`. O build compila
TypeScript e gera os arquivos estáticos em `frontend/dist/`.

### Backend

Com o backend e MongoDB de teste/configurados, execute na pasta `backend`:

```powershell
python -m pytest
```

O `pytest.ini` configura dois workers do `pytest-xdist`. Os fixtures de
`backend/tests/conftest.py` fazem requisições HTTP ao backend ativo em `localhost:8001`
(ou `BACKEND_URL`) e usam as contas de seed/default tenant. Portanto, para essa suíte,
inicie a API com um banco de desenvolvimento/teste antes de rodar; não aponte testes
que modificam dados para produção.

### Navegador (Playwright)

Na pasta `tests`:

```powershell
yarn install
yarn playwright test
```

O `playwright.config.ts` usa `http://localhost:3000`, Chromium e projetos desktop
(1440×900) e mobile (390×844). Os testes cobrem fluxos públicos, login, recuperação,
provisionamento da plataforma, permissões, clientes e agenda. Eles compartilham o
ambiente configurado; execute contra ambiente de teste/de desenvolvimento.

## Build e implantação

Para compilar a interface:

```powershell
cd C:\salomCrm\frontend
yarn build
```

Sirva `frontend/dist/` com um servidor estático e encaminhe `/api` à API FastAPI.
A configuração de Vite é para desenvolvimento/preview, não é um servidor de produção.
O repositório não contém um manifesto específico de hospedagem ou pipeline de release;
reverse proxy, provisionamento, backups, monitoramento e gestão de segredos dependem
da plataforma de implantação escolhida.

### Checklist antes de produção

1. Defina `APP_ENV=production`, `COOKIE_SECURE=true`, slug padrão e credenciais master
   fortes, além de um `RATE_LIMIT_SECRET` aleatório com pelo menos 32 caracteres, no
   gerenciador de segredos do host.
2. Use MongoDB remoto com autenticação e TLS; habilite backup e teste restauração.
3. Liste somente origens HTTPS explícitas em `CORS_ORIGINS`.
4. Configure `PUBLIC_APP_URL`, SMTP e remetente válidos; teste entrega e consumo de
   links de recuperação.
5. Sirva frontend e API preferencialmente sob a mesma origem HTTPS e configure o proxy
   para preservar o esquema HTTPS. Se usar proxy reverso, configure somente seus IPs
   em `TRUSTED_PROXY_IPS`.
6. Faça build de produção e teste autenticação, cookies, isolamento entre tenants,
   criação de espaço e recuperação em staging antes de trocar o tráfego.
7. Configure health checks: `/health/live` para liveness e `/health/ready` para
   readiness.
8. Para migrar uma instalação antiga, faça e verifique backup restaurável; depois
   execute uma única vez `python migrate_tenants.py --confirm-backup` dentro de
   `backend`, em procedimento controlado e sem instâncias da API concorrentes.

O migrador atribui dados antigos sem tenant ao tenant padrão e atualiza índices. Não
rode contra produção sem revisar o destino e validar o backup.

## Manutenção e solução de problemas

### A interface abre, mas os dados não carregam

- Confirme que MongoDB e API estão ativos em `8001`.
- Confira `backend/.env`, o log de startup e a resposta de `/health/ready`.
- Confira o destino do proxy `API_PROXY_TARGET`; por padrão é `http://localhost:8001`.
- No navegador, 401 normalmente indica sessão ausente/expirada; entre novamente.

### Não consigo entrar

- O slug precisa identificar um tenant ativo; confirme o e-mail e a senha.
- Se o banco foi recriado, execute `python seed.py` apenas no ambiente local de
  demonstração.
- Login da plataforma usa a conta master, não uma conta `admin` de salão.
- A conta master só é criada se `PLATFORM_OWNER_EMAIL` e
  `PLATFORM_OWNER_PASSWORD` estiverem configurados juntos.

### Agendamento recusado

- Confirme que cliente, serviço e profissional estão ativos.
- Um profissional não pode ter sobreposição com outro agendamento não cancelado.
- O fim do serviço precisa ocorrer antes da meia-noite.
- HTTP 409 indica conflito de horário ou edição simultânea; atualize a tela e tente
  novamente.

### Recuperação de senha indisponível

- Em desenvolvimento, configure `PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT` e
  `SMTP_FROM_EMAIL`; configure usuário/senha SMTP em par quando necessário.
- Em produção, a API exige uma origem pública HTTPS e os campos SMTP durante startup.
- Verifique conectividade e autenticação com o provedor de e-mail nos logs do backend.

### Onde alterar contratos e textos

- Ao alterar um modelo de API, atualize o respectivo modelo em `backend/models/` e o
  espelho TypeScript em `frontend/src/lib/types.ts`.
- Rotas de servidor são implementadas em `backend/routers/`.
- Páginas e componentes ficam em `frontend/src/pages/` e
  `frontend/src/components/`.
- Traduções de interface ficam em `frontend/src/lib/i18n.tsx`; o provider está em
  `frontend/src/lib/I18nProvider.tsx`. Após adicionar texto visível, inclua as
  traduções e valide com lint/build.
