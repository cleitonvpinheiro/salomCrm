# Atelier — CRM web para gestão de salões de beleza

> **Rascunho conforme o Anexo 2 do modelo institucional. Não entregar sem revisão.**
> Os campos marcados como **[PREENCHER]** exigem informações do(a) aluno(a), do(a)
> orientador(a) ou evidências do processo real. Este documento não inventa entrevistas,
> sessões de Design Thinking, resultados de avaliação, parceiros ou projeções.

## Identificação

- **Nome da startup/produto:** Atelier
- **Nome(s) do(s) aluno(s):** [PREENCHER]
- **Curso:** Tecnologia e Desenvolvimento de Sistemas
- **Instituição:** [PREENCHER]
- **E-mail de contato:** [PREENCHER]
- **Orientador(es):** [PREENCHER]
- **Instituição e e-mail do(s) orientador(es):** [PREENCHER]
- **Local e ano:** [PREENCHER], 2026

## Resumo

Este trabalho documenta o desenvolvimento do Atelier, uma aplicação web de CRM
voltada à gestão de salões de beleza. O sistema reúne cadastro e histórico de clientes,
agenda, serviços, profissionais e gestão da equipe, além de permitir a administração
de diferentes salões em uma mesma instalação, com separação dos registros por espaço.
O frontend foi implementado com React e TypeScript; a API utiliza FastAPI e Pydantic;
os dados são persistidos em MongoDB. A solução inclui autenticação por sessão,
permissões por perfil, indicadores operacionais, filtros e fluxos para agendamento e
conclusão de atendimentos. As verificações técnicas já realizadas incluem typecheck,
lint e build do frontend, 27 testes unitários do backend com dependências simuladas e
12 testes de interface independentes de banco, executados em desktop e mobile. A
suíte de integração com MongoDB/API e a avaliação com usuários ainda não foram
concluídas; portanto, não se afirmam resultados de usabilidade ou impacto operacional.
Os resultados finais deverão ser atualizados após essas etapas.

**Palavras-chave:** CRM; salão de beleza; aplicação web; multi-tenancy; agenda.

## 1. Problema tratado

Salões de beleza precisam organizar informações de clientes, histórico de visitas,
agenda, serviços e profissionais. Quando essas informações ficam dispersas, consultar
o histórico e coordenar os atendimentos pode se tornar mais trabalhoso. A dimensão
desse problema no contexto estudado ainda precisa ser demonstrada com evidências
verificáveis, como dados secundários, observação autorizada ou levantamento com o
público-alvo.

O projeto trata da centralização desses processos em uma aplicação web. O Atelier
permite administrar clientes e suas anotações, organizar a agenda, manter o catálogo
de serviços e profissionais e controlar contas da equipe. A separação por salão
(`tenant_id`) atende ao cenário em que diferentes espaços utilizam a mesma instalação
sem compartilhar seus registros.

### 1.1 Problema de pesquisa

Como uma aplicação web de CRM pode apoiar a centralização do cadastro e histórico de
clientes, da agenda e da gestão de equipe em salões de beleza, mantendo isolados os
dados de cada salão?

**Delimitação do contexto:** [PREENCHER com cidade/região, perfil dos salões e
processo observado, se aplicável. Não atribuir ao público dificuldades que não foram
investigadas.]

### 1.2 Evidências sobre a dimensão do problema

| Evidência a levantar | Fonte ou método | Resultado/evidência |
|---|---|---|
| Dimensão do setor de beleza no contexto escolhido | [PREENCHER: fonte oficial ou setorial] | [PREENCHER] |
| Como o público organiza clientes e agenda atualmente | [PREENCHER: entrevista, observação ou questionário, se aprovado] | [PREENCHER] |
| Dificuldades e necessidades recorrentes | [PREENCHER: método e período] | [PREENCHER] |

Não apresentar hipótese ou dado sem fonte como se fosse resultado de pesquisa.

## 2. Design Thinking

O relatório institucional solicita demonstrar o uso de Design Thinking por meio das
fases e do ciclo. O repositório contém o produto, mas não comprova quando ou como
foram realizadas as atividades de pesquisa, ideação ou prototipação. Complete esta
seção com registros do processo efetivamente realizado e valide o método com o(a)
orientador(a).

### 2.1 Imersão

Devem ser apresentadas **no mínimo duas técnicas de imersão**, informando para cada
uma: objetivo, participantes/fonte, data/período, procedimento, evidências coletadas,
principais achados e como esses achados influenciaram os requisitos. Sugestões de
técnicas a discutir com o(a) orientador(a):

1. **Pesquisa secundária/análise documental:** consultar fontes verificáveis sobre
   gestão de salões, CRM e soluções existentes; registrar referências e critérios.
2. **Entrevista semiestruturada ou observação contextual:** somente após definir
   participantes, consentimento, proteção de dados e autorização institucional.

| Técnica | Data e fonte/participantes | Evidência coletada | Achado | Requisito afetado |
|---|---|---|---|---|
| Técnica de imersão 1 — [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| Técnica de imersão 2 — [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |

### 2.2 Ideação

O modelo solicita **pelo menos um momento de ideação realizado**. Registre a sessão
real, incluindo data, participantes, método utilizado, ideias geradas, critérios de
seleção e decisão final. Não descreva uma sessão como realizada se ela ainda não
aconteceu.

| Data/participantes | Método | Ideias consideradas | Critérios de seleção | Decisão e justificativa |
|---|---|---|---|---|
| [PREENCHER após a atividade] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |

### 2.3 Prototipação

Descreva a evolução dos protótipos com evidências datadas: esboços, wireframes,
versões de tela, feedback recebido e alterações realizadas. O produto atual possui
site público, login, telas de clientes, agenda, profissionais, serviços, equipe e
administração da plataforma. A existência dessas telas não comprova, por si só, as
etapas anteriores de prototipação.

| Versão/data | Artefato ou tela | Alteração realizada | Motivo/evidência | Anexo |
|---|---|---|---|---|
| [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |

### 2.4 Ciclo de Design Thinking

Inclua um diagrama do ciclo usado no trabalho e conecte cada etapa a suas evidências:
imersão → definição do problema → ideação → prototipação → teste/avaliação →
aprendizado e iteração. Altere a sequência somente se corresponder ao método
orientado pelo curso.

## 3. Produtos já existentes

Investigue soluções existentes para gestão de salões e compare funcionalidades com
critérios explícitos. A tabela abaixo é um roteiro de pesquisa; nomes, recursos,
preços e conclusões devem ser preenchidos após consulta às fontes oficiais, com data
de acesso. Não usar esta matriz vazia como comparação concluída.

| Produto | Público e proposta (fonte) | Clientes/histórico | Agenda/equipe | Relatórios/exportação | Diferenças relevantes |
|---|---|---|---|---|---|
| [Produto 1 — pesquisar] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| [Produto 2 — pesquisar] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |
| [Produto 3 — pesquisar] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] | [PREENCHER] |

Apresente a contribuição do Atelier com base nessa comparação e no problema
investigado, sem alegar superioridade sem critérios e evidências.

## 4. Objetivos específicos

### 4.1 Objetivo geral

Desenvolver e documentar uma aplicação web de CRM para centralizar a gestão de
clientes, agenda, serviços e equipe de salões de beleza.

### 4.2 Objetivos específicos

1. Identificar e registrar requisitos do contexto escolhido usando técnicas de imersão
   documentadas.
2. Projetar uma solução web e um modelo de dados que associem clientes, profissionais,
   serviços e atendimentos, mantendo a separação dos dados por salão.
3. Implementar os fluxos de clientes, agenda, serviços, profissionais e usuários com
   permissões por perfil.
4. Verificar os fluxos implementados por testes automatizados e cenários reproduzíveis.
5. Avaliar os resultados segundo critérios aprovados pelo(a) orientador(a), registrando
   limitações e oportunidades futuras.

Revise os objetivos para que correspondam ao trabalho e às atividades de fato
realizadas.

## 5. Versão final do protótipo/produto

### 5.1 Tecnologias e arquitetura

O frontend utiliza React 19, TypeScript, Vite, React Router, TanStack Query e Tailwind
CSS. A API utiliza Python, FastAPI e Pydantic; o acesso ao MongoDB é feito com Motor/
PyMongo. A autenticação utiliza sessões armazenadas no banco e cookies `httpOnly`.
Os registros dos salões são filtrados por `tenant_id`, e o backend verifica os papéis
nas operações administrativas. A descrição técnica detalhada consta no
[manual do sistema](./SISTEMA.md).

Inclua aqui diagrama de arquitetura, diagrama de dados e fluxos de autenticação e
agendamento. Explique as decisões e limitações com base nas fontes consultadas.

### 5.2 Entidades, cadastros e operações

O sistema contém entidades de tenants/salões, usuários, clientes, profissionais,
serviços, agendamentos, anotações e sessões. A matriz abaixo relaciona seis áreas de
cadastro às operações existentes. Arquivar/desativar é exclusão lógica: os registros
e históricos não são removidos fisicamente.

| Cadastro/entidade | Criar | Consultar | Atualizar | Exclusão/encerramento lógico |
|---|---|---|---|---|
| Clientes | Sim | Sim | Sim | Arquivar/restaurar |
| Profissionais | Admin | Sim | Admin | Arquivar |
| Serviços | Admin | Sim | Admin | Arquivar |
| Agendamentos | Sim | Sim | Sim | Cancelar; admin pode remover |
| Usuários da equipe | Admin | Admin | Admin | Desativar |
| Salões (tenants) | Admin da plataforma | Admin da plataforma | Estado ativo/inativo | Desativar; não há exclusão física |

Confirme a matriz contra o comportamento da versão demonstrada e apresente telas ou
casos de teste como evidência. A tabela lista entidades funcionais; não significa que
cada uma corresponde a uma tabela relacional no MongoDB.

### 5.3 Relacionamento muitos-para-muitos

No modelo conceitual, clientes e serviços podem se relacionar muitos-para-muitos ao
longo do tempo: um cliente pode contratar vários serviços e um serviço pode ser
realizado para vários clientes. O relacionamento é registrado pela entidade
associativa **Agendamento**: cada agendamento referencia um cliente e um serviço e
guarda atributos próprios, como data, horário, profissional, estado e snapshot de
preço/duração. Assim, Cliente 1:N Agendamentos e Serviço 1:N Agendamentos representam
Cliente N:M Serviço por meio dos agendamentos.

Inclua o diagrama ER com as cardinalidades e explique que o banco utilizado é
documental; “tabela” no requisito acadêmico corresponde às entidades/coleções
documentadas, não a tabelas SQL.

### 5.4 Relatórios pertinentes ao problema

O código oferece pelo menos estas visões de consulta que podem ser demonstradas como
relatórios operacionais:

1. **Indicadores da carteira e retornos:** total de clientes ativos, profissionais
   ativos, visitas no mês, retornos pendentes, clientes sem profissional e clientes
   arquivados, apresentados no painel.
2. **Agenda de atendimentos:** consulta por dia ou intervalo, com possibilidade de
   filtrar por cliente, profissional e situação.
3. **Carteira de clientes:** busca, filtros por profissional, arquivados e ordenação
   por nome/data da última visita.

Essas telas não devem ser descritas como exportação PDF/Excel: o repositório não
implementa geração de arquivos de relatório. Confirme com o(a) orientador(a) se as
visões existentes satisfazem o requisito de “relatórios”; se não, implemente e teste
uma saída apropriada antes de afirmar conformidade.

### 5.5 Controle administrativo e site do usuário final

O painel `/platform` permite ao administrador da plataforma consultar, criar e
ativar/desativar espaços. A área `/team` permite ao administrador de salão gerenciar
contas e papéis. O site público apresenta o produto e encaminha ao login; a área
autenticada disponibiliza clientes, agenda, profissionais, serviços e equipe. Inclua
capturas de tela e descreva uma tarefa de usuário por fluxo, usando somente dados
fictícios.

### 5.6 Versionamento, ciclo de vida e trechos de código

O código está versionado em Git. Documente os marcos verificáveis por histórico,
tags ou commits revisados. Descreva o ciclo de vida realmente adotado (requisitos,
implementação, revisão, testes e entrega) e inclua trechos curtos de código próprios
que ilustrem uma regra de negócio ou isolamento por tenant, com arquivo e contexto.
Não invente datas, sprints ou versões sem evidência.

## 6. Lean Canvas

Preencha e revise os nove blocos com o(a) orientador(a). As propostas abaixo são
hipóteses iniciais, não resultados de pesquisa de mercado.

| Bloco | Hipótese inicial / informação a validar |
|---|---|
| Problema | [Validar dificuldades de organização de clientes, agenda e equipe] |
| Segmentos de clientes | [Definir porte, perfil e localização dos salões] |
| Proposta única de valor | [Redigir com base na pesquisa e comparação] |
| Solução | CRM web para clientes, agenda, serviços e equipe |
| Canais | [Validar canais de aquisição e atendimento] |
| Fontes de receita | [Definir modelo; não há dados de validação no repositório] |
| Estrutura de custos | [Estimar desenvolvimento, hospedagem, banco, e-mail e suporte] |
| Métricas-chave | [Definir métricas de aquisição, ativação e uso] |
| Vantagem difícil de copiar | [Não presumir; validar frente às soluções existentes] |

## 7. Startup

- **Nome:** Atelier (nome de trabalho do sistema; verificar disponibilidade e uso da
  marca antes de qualquer exploração comercial).
- **Logo:** [CRIAR/INSERIR ARTE ORIGINAL OU LICENCIADA].
- **Missão:** [PREENCHER após validação da proposta].
- **Visão:** [PREENCHER].
- **Valores:** [PREENCHER].
- **Área de atuação:** software de gestão/CRM para salões de beleza.
- **Necessidade de investimento:** [ESTIMAR com premissas, período e custos; não
  inventar valores].
- **Possíveis parceiros:** [IDENTIFICAR e validar; não apresentar organizações como
  parceiras sem autorização/compromisso].

## 8. Validação e resultados

### 8.1 Evidências técnicas já disponíveis

| Verificação | Resultado observado | O que não comprova |
|---|---|---|
| Frontend: typecheck, lint e build | Aprovados nesta preparação | Não comprova integração com o banco nem usabilidade |
| Testes unitários selecionados do backend | 27 aprovados com dependências simuladas | Não comprova integração real com MongoDB |
| Playwright, cenários independentes de banco | 12 aprovados em desktop e mobile | Não cobre CRUD integrado à API |
| Suíte completa backend/API/MongoDB | Pendente; ambiente não disponível durante a execução | Não permite afirmar aprovação da integração |
| Avaliação com usuários | Não realizada | Não permite afirmar facilidade de uso ou impacto |

Atualize esta tabela com a data, os comandos, as versões do ambiente, os resultados
finais e defeitos corrigidos. Os testes integrados precisam ser executados contra um
MongoDB explicitamente isolado para testes, nunca contra dados de produção.

### 8.2 Avaliação a realizar

Defina com o(a) orientador(a) se a validação será exclusivamente técnica ou também
com usuários. Para cada cenário técnico, registre estado inicial, passos, resultado
esperado, resultado obtido e evidência. Se houver participantes, defina previamente
consentimento, privacidade, critérios de seleção e método de análise com a instituição.
Não use dados reais de clientes na apresentação.

## 9. Limitações e trabalhos futuros

As limitações a verificar e discutir incluem: ausência de avaliação com usuários;
suíte integrada ainda pendente; falta de pipeline CI/CD e infraestrutura específica de
implantação no repositório; ausência de limitação de tentativas, proteção CSRF e
monitoramento operacional; e ausência de exportação de relatórios. Diferencie as
limitações que permanecem das que forem resolvidas antes da entrega. Trabalhos futuros
podem ser definidos após os resultados e a orientação recebida.

## 10. Referências e anexos

**Referências:** [INSERIR fontes acadêmicas e fontes oficiais realmente consultadas,
formatadas de acordo com a instituição.]

**Anexos/apêndices recomendados:** evidências das duas técnicas de imersão; registro da
ideação; protótipos por versão; diagramas; requisitos e critérios de aceitação;
resultados dos testes; roteiro e resultados de avaliação autorizada; capturas de tela
sem dados pessoais.

## Conferência do modelo institucional antes da entrega

- O relatório deve ter **de 10 a 20 páginas**; ajustar a paginação no editor de texto
  conforme o padrão institucional.
- Confirmar se o curso exige seis cadastros completos, contando administrador. A
  matriz deste rascunho identifica seis áreas, mas algumas usam arquivamento/
  desativação em vez de exclusão física.
- Demonstrar o relacionamento N:M Cliente–Serviço por Agendamentos no diagrama e
  validar a interpretação com o(a) orientador(a).
- Demonstrar pelo menos dois relatórios operacionais e confirmar se consultas/telas sem
  exportação satisfazem o requisito.
- Apresentar controle administrativo e site/fluxos do usuário final.
- Registrar pelo menos duas orientações realizadas com o(a) professor(a), agendadas
  previamente, conforme a instrução institucional.
- Validar o documento com o(a) orientador(a), enviar pelo AVA/LXP e preparar
  apresentação conforme as instruções da disciplina.
