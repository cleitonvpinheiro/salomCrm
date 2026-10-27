# Atelier — CRM para salões de beleza

O Atelier é uma aplicação web para organizar clientes, histórico de atendimentos,
agenda, serviços e equipe de salões de beleza. Uma mesma instalação pode atender
vários salões, mantendo os registros separados por espaço de trabalho (tenant).

> Projeto acadêmico/em desenvolvimento. Use dados fictícios em demonstrações. A
> configuração local não representa uma implantação pronta para produção.

## Funcionalidades

- Cadastro, busca, histórico e arquivamento/restauração de clientes.
- Agenda para criar, reagendar, cancelar e concluir atendimentos.
- Bloqueio de horários sobrepostos para o mesmo profissional.
- Cadastro de profissionais, serviços e contas da equipe.
- Perfis de salão (`admin` e `staff`) e painel separado para administração da plataforma.
- Separação de dados por salão, paginação e indicadores operacionais.
- Interface em português do Brasil, inglês e espanhol.
- Recuperação de senha por e-mail, quando SMTP está configurado.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query e Tailwind CSS |
| API | Python, FastAPI e Pydantic |
| Persistência | MongoDB com Motor/PyMongo |
| Testes | pytest e Playwright |

## Estrutura

```text
backend/     API, modelos, acesso ao MongoDB, seed e testes Python
frontend/    aplicação React/TypeScript e configuração do Vite
tests/       fluxos de ponta a ponta com Playwright
docs/        manual do sistema e base do relatório técnico
```

Documentação complementar:

- [Manual do sistema](docs/SISTEMA.md)
- [Base do relatório técnico do TCC](docs/TCC_BASE.md) — rascunho; requer revisão,
  evidências do processo e adequação às normas da instituição.

## Requisitos para desenvolvimento

- Python 3.11 ou superior.
- Node.js compatível com Vite 8.
- Yarn para o frontend.
- MongoDB acessível.

Os comandos a seguir são para PowerShell no Windows. Em outros sistemas, adapte os
comandos de criação/ativação do ambiente virtual.

## Executar localmente

### 1. Configurar e iniciar a API

```powershell
cd C:\salomCrm\backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edite `backend/.env` e configure `MONGO_URL` e `DB_NAME` para apontar para um banco
local de desenvolvimento. Não use dados de produção para testes ou demonstrações.

Para carregar os dados demonstrativos:

```powershell
python seed.py
```

O seed local cria contas demonstrativas:

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador do salão | `admin@atelier.com` | `atelier123` |
| Equipe | `marina@atelier.com` | `atelier123` |

Essas credenciais são públicas e servem **somente** para desenvolvimento local.
Nunca as reutilize em produção.

Inicie a API:

```powershell
python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

A API fica em `http://localhost:8001/api`; a documentação interativa do FastAPI fica
em `http://localhost:8001/docs`.

### 2. Configurar e iniciar o frontend

Em outro terminal:

```powershell
cd C:\salomCrm\frontend
yarn install
yarn dev
```

A aplicação fica em `http://localhost:3000`. Durante o desenvolvimento, o Vite
encaminha as chamadas `/api` para `http://localhost:8001`.

### Administração da plataforma

Para habilitar o acesso master em desenvolvimento, configure
`PLATFORM_OWNER_EMAIL` e `PLATFORM_OWNER_PASSWORD` em `backend/.env` antes de iniciar
a API. A conta master é separada das contas dos salões.

## Configuração

As configurações do backend são lidas de `backend/.env`:

| Variável | Uso |
|---|---|
| `MONGO_URL` ou `MONGODB_URI` | URI de conexão do MongoDB |
| `DB_NAME` | Nome do banco |
| `APP_ENV` | Ambiente; use `development` localmente |
| `DEFAULT_TENANT_SLUG` | Identificador do espaço padrão |
| `PLATFORM_OWNER_EMAIL` e `PLATFORM_OWNER_PASSWORD` | Conta administradora da plataforma |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgulas |
| `COOKIE_SECURE` | Ativa cookies Secure quando servido por HTTPS |
| `RATE_LIMIT_SECRET` | Segredo aleatório de pelo menos 32 caracteres; obrigatório em produção para os limites de autenticação |
| `TRUSTED_PROXY_IPS` | IPs/CIDRs dos proxies reversos confiáveis, separados por vírgulas; opcional |
| `PUBLIC_APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM_EMAIL` | Link e envio da recuperação de senha |
| `SMTP_USERNAME` e `SMTP_PASSWORD` | Credenciais SMTP opcionais, configuradas em par |

Opções públicas do frontend:

| Variável | Uso |
|---|---|
| `API_PROXY_TARGET` | Destino do proxy `/api` do Vite; padrão `http://localhost:8001` |
| `VITE_DEFAULT_TENANT_SLUG` | Sugestão de espaço na tela de login |
| `VITE_WHATSAPP_NUMBER` | Número comercial, somente dígitos e com código do país/DDD |

Variáveis `VITE_*` são incorporadas ao frontend e não podem conter segredos. Não
versione arquivos `.env`, senhas, tokens ou dados reais de clientes.

## Verificações

### Frontend

Na pasta `frontend`:

```powershell
yarn typecheck
yarn lint
yarn build
```

### Backend

Os testes de API usam o backend ativo e contas do banco de desenvolvimento. Inicie
MongoDB, configure e prepare um banco de teste isolado e inicie a API antes de executar.
**Não execute testes que alteram dados contra produção.**

Na pasta `backend`:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Os testes que chamam uma API ativa enviam `Origin: http://localhost:3000` por padrão.
Se o frontend de teste usar outra origem, defina `TEST_CLIENT_ORIGIN` com essa origem
antes de executar o pytest.

### Testes de navegador

Os testes que cobrem fluxos integrados precisam do frontend, da API e do banco de teste
ativos. Alguns cenários usam respostas simuladas e não dependem da API. Na primeira
execução, instale as dependências do workspace:

```powershell
cd C:\salomCrm\tests
npm install
npx playwright install chromium
npx playwright test
```

O Playwright executa os cenários em Chromium para desktop e mobile. Consulte
[tests/e2e/](tests/e2e/) para os fluxos cobertos e a configuração em
[playwright.config.ts](tests/playwright.config.ts).

## Regras importantes

- Os dados de cada salão são associados a um `tenant_id`; a autorização é verificada
  também no backend.
- Arquivar clientes, profissionais e serviços preserva registros e históricos.
- Agendamentos cancelados não reservam horário; a agenda rejeita sobreposições para
  o mesmo profissional.
- Concluir um atendimento registra a visita no histórico do cliente e pode ser
  repetido com segurança.
- A recuperação gera links de uso único com validade de 30 minutos, mas exige
  configuração de e-mail para enviar esses links.
- Login do salão e da plataforma têm limite de 20 tentativas por IP a cada 15 minutos;
  pedidos de recuperação, 5 por hora; redefinições de senha, 10 por hora. Os contadores
  ficam no MongoDB e são removidos por índice TTL.
- Os identificadores dos limites são derivados com HMAC e `RATE_LIMIT_SECRET`; os
  endereços IP não são armazenados diretamente nos documentos de limite.
- Requisições de alteração autenticadas por cookie precisam incluir um cabeçalho
  `Origin` ou `Referer` de uma origem listada em `CORS_ORIGINS`; caso contrário, a API
  responde `403`. Isso inclui clientes HTTP que reutilizam cookies.
- `X-Forwarded-For` só é usado para identificar o IP do cliente quando a conexão vem
  de um proxy listado em `TRUSTED_PROXY_IPS`. Não confie em cabeçalhos encaminhados
  enviados diretamente por clientes.

## Produção e segurança

O servidor de desenvolvimento e as credenciais do seed não são adequados para
produção. Antes de uma implantação real, configure HTTPS, cookies seguros, origens
CORS explícitas, MongoDB remoto autenticado com TLS, segredos fortes e SMTP; faça e
verifique backups; e valide a implantação em staging. Consulte o
[manual do sistema](docs/SISTEMA.md) para os requisitos de configuração e migração.

O repositório ainda não inclui pipeline de release, monitoramento operacional ou
manifests de implantação específicos de provedor. Os limites de autenticação e a
validação CSRF já estão implementados na API, mas não substituem WAF/mitigação de DDoS,
monitoramento, backups testados, gestão de segredos e validação em staging. Configure
`RATE_LIMIT_SECRET` no gerenciador de segredos em produção; se houver proxy reverso,
configure somente seus endereços em `TRUSTED_PROXY_IPS`. Consulte o manual para o
checklist completo de implantação.
