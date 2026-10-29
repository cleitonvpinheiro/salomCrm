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
- Agendamento online por link público, com horários do salão e de cada profissional.
- Cadastro de profissionais, serviços e contas da equipe.
- Identidade visual por salão, com nome, logotipo e cores personalizados pelo administrador.
- Perfis de salão (`admin` e `staff`) e painel separado para administração da plataforma.
- Separação de dados por salão, paginação e indicadores operacionais.
- Interface em português do Brasil, inglês e espanhol.
- Recuperação de senha por e-mail, quando SMTP está configurado.

## Proposta inicial de planos e valores

Os valores abaixo são hipóteses comerciais para validar com salões e profissionais
antes do lançamento. Ainda não representam cobrança ativa no sistema nem uma oferta
comercial definitiva.

| Plano sugerido | Equipe incluída | Valor mensal sugerido |
|---|---:|---:|
| Solo | 1 profissional | R$ 39 |
| Essencial | Até 2 profissionais | R$ 59 |
| Salão | Até 5 profissionais | R$ 99 |
| Studio | Até 10 profissionais | R$ 149 |

A proposta é manter uma mensalidade por salão, sem cobrança adicional por usuário
dentro do limite do plano. Os recursos centrais — gestão de clientes, agenda, serviços,
agendamento online e identidade visual — estão previstos para todos os planos; os
limites variam pelo tamanho da equipe. O plano Solo é direcionado a quem trabalha
individualmente. Planos, limites, preços, teste gratuito e condições para clientes
fundadores ainda precisam ser validados e implementados antes de iniciar cobranças.

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
local de desenvolvimento. Mantenha `http://localhost:3000` e
`http://127.0.0.1:3000` em `CORS_ORIGINS` se puder acessar o frontend pelos dois
endereços. Não use dados de produção para testes ou demonstrações.

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

### Testar em outro equipamento na rede local

1. Conecte os dois equipamentos à mesma rede Wi-Fi. No computador que executa o
   Atelier, use `ipconfig` para encontrar o endereço IPv4 do adaptador Wi-Fi; neste
   ambiente, por exemplo, o endereço é `192.168.1.239`.
2. Para evitar que uma reconexão do celular interrompa o carregamento de módulos do
   servidor de desenvolvimento/HMR, gere e sirva a versão de produção local. No
   terminal do frontend, pare `yarn dev` com `Ctrl+C` e execute:

   ```powershell
   yarn build
   yarn preview --host 0.0.0.0 --port 3000 --strictPort
   ```

   O preview usa os arquivos compilados e mantém o proxy `/api` para o backend.
   Não execute `yarn dev` e `yarn preview` simultaneamente na porta 3000.
3. Se a API já estiver usando apenas a origem local padrão, pare-a e inicie-a de novo
   no terminal do backend, permitindo também a origem do computador na rede:

   ```powershell
   $env:CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.239:3000"
   python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
   ```

   Substitua `192.168.1.239` pelo IPv4 encontrado no primeiro passo. O frontend já
   escuta nas interfaces de rede; no outro equipamento, abra
   `http://192.168.1.239:3000`, também substituindo o endereço pelo correto.
4. Se o Firewall do Windows bloquear a conexão, abra o PowerShell como administrador
   e crie uma regra limitada à porta do frontend e à sub-rede local. O perfil abaixo
   corresponde ao Wi-Fi classificado como Público neste ambiente:

   ```powershell
   New-NetFirewallRule -DisplayName "Atelier LAN test (TCP 3000)" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress LocalSubnet -Profile Public
   ```

   Ao terminar os testes, remova a regra no PowerShell:

   ```powershell
   Remove-NetFirewallRule -DisplayName "Atelier LAN test (TCP 3000)"
   ```

Se a conexão falhar mesmo com a regra ativa, verifique se a rede Wi-Fi não isola os
dispositivos entre si. Mantenha a API na interface local (`127.0.0.1`) e não abra as
portas `8001` (API) ou do MongoDB para a rede. O servidor Vite é apenas para
desenvolvimento: não o exponha à Internet.

### Administração da plataforma

Para habilitar o acesso master em desenvolvimento, configure
`PLATFORM_OWNER_EMAIL` e `PLATFORM_OWNER_PASSWORD` em `backend/.env` antes de iniciar
a API. A conta master é separada das contas dos salões.

### Agendamento online

Para liberar reservas online em desenvolvimento:

1. Entre no Atelier com uma conta de administrador do salão.
2. Cadastre ao menos um serviço ativo e um profissional ativo.
3. Abra **Agendamento online** no menu e configure os dias/horários em que o salão
   funciona e a disponibilidade semanal de cada profissional.
4. Ative o recurso e compartilhe o link público exibido nessa tela:
   `http://localhost:3000/agendar/<slug-do-salao>`.

O agendamento começa desativado. A página só oferece horários na interseção dos
horários do salão e do profissional; os horários ocupados também são excluídos. O
cliente escolhe serviço, profissional ou qualquer profissional disponível, data e
horário, informa nome e telefone e recebe confirmação imediata. Os horários são
oferecidos em intervalos de 30 minutos, respeitando a duração do serviço, e as reservas
podem ser feitas para hoje ou até 30 dias à frente. O nome e o telefone são associados
ao cadastro de clientes do salão.

Esta versão não envia notificações e não oferece alteração ou cancelamento pela página
pública; para isso, o cliente deve falar diretamente com o salão. A API limita as
tentativas de reserva pública por IP.

### Identidade visual do salão

O administrador de cada salão pode abrir **Identidade visual** no menu para alterar
o nome exibido, enviar/remover o logotipo e escolher as cores principal e de destaque.
São aceitos arquivos PNG, JPEG ou WebP de até 2 MB. As alterações se aplicam ao painel
autenticado do salão e à página pública de agendamento; não alteram o login da
plataforma. Cada salão mantém sua própria identidade visual.

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
