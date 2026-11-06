# Uber Pro Max (Corridas Relatório) — Documentação Técnica Completa

> **Guia Definitivo do Projeto, Arquitetura, Mapeamento de Arquivos e Diretrizes para Agentes de IA**

---

## 1. Visão Geral do Projeto

O **Uber Pro Max** (também conhecido como **Corridas Relatório**) é uma aplicação web progressiva (PWA) de telemetria, gestão financeira e controle operacional para motoristas de aplicativo (Uber, 99 e corridas particulares).

### 🎯 Proposta de Valor
- **Mobile First & Ultra-Leve:** Desenvolvido em HTML5 e JavaScript Vanilla modular (ES Modules), com zero frameworks pesados no frontend, pesando cerca de 8 KB comprimido (gzip).
- **Zero Dependências em Runtime:** Não utiliza bibliotecas externas no backend (nem Express, nem Axios, nem Supabase-JS). Todas as chamadas ao Supabase usam a API REST nativa com `fetch` nativo do Node.js 18+.
- **Entrada de Dados Multicanal com NLP:** Permite registrar corridas, abastecimentos, despesas e odômetro por texto informal no WhatsApp (via webhooks Z-API, Evolution API, WAHA), por script de automação no navegador (Tampermonkey) ou pela própria interface do app (campo rápido ou formulário detalhado).
- **Gestão de Custos Dinâmicos & Veículos:** Suporta múltiplos veículos cadastrados, calculando automaticamente custos fixos (aluguel por semana/mês/dia) e variáveis (combustível dinâmico com base nos abastecimentos e odômetro real).
- **Metas Inteligentes & Engenharia Reversa de Lucro:** Define metas de faturamento bruto a partir do lucro líquido desejado pelo motorista, compensando automaticamente os custos fixos e a margem de combustível.
- **Resiliência Offline:** Suporta modo PWA instalável com ícones e fontes locais (Space Grotesk, Inter, JetBrains Mono) pré-carregadas.

---

## 2. Arquitetura e Tecnologias

```
[ Motorista (WhatsApp) ] ──> [ Webhook /api/whatsapp ] ──┐
[ drivers.uber.com ]    ──> [ Script Tampermonkey ]   ──┼──> [ Supabase REST API ]
[ Navegador / PWA ]     ──> [ API Client (/api/*) ]   ──┘          (PostgreSQL)
         │
         ├── Serverless (Vercel) ou Servidor Local (server.js via Node nativo)
         └── UI Vanilla modular (Store Reativa + Modais + Gráficos SVG/Canvas)
```

- **Frontend:** HTML5 semântico, JavaScript ES Modules puro (`/public/js/`), CSS nativo com Tailwind CSS v4 CLI (`src/styles.css` compila para `public/css/app.css`).
- **Backend:** Funções Serverless no padrão Vercel (`/api/*.js`), executáveis também em ambiente local através do `server.js` em Node.js puro (`node:http`).
- **Banco de Dados:** Supabase (PostgreSQL), consultado diretamente via PostgREST na porta HTTPS com RLS ativado e autenticação por `service_role` ou chave `anon`.
- **Testes:** Bateria de testes unitários e de integração em Node.js puro (`test/`), executada via `npm test`.

---

## 3. Principais Funcionalidades e Regras de Negócio

### 3.1. Interpretador de Mensagens e NLP (`lib/parse.js`)
O sistema analisa frases em linguagem natural, aceitando múltiplos formatos em uma única linha ou separados por quebra de linha/ponto-e-vírgula:
- **Corridas:** `25,50 joão 14:30` (ganho R$ 25,50, passageiro João, horário 14:30) ou `18 maria 6km`.
- **Despesas com Categoria Automática:** `gas 150` ou `abasteci 120` (combustível), `almoço 25` (alimentação), `lavagem 30` (lavagem), `aluguel 560` (aluguel).
- **Odômetro:** `odo 45230` ou apenas números soltos superiores a 2000 (ex.: `45230`).
- **Sessões de Trabalho:** `inicio 45100` / `comecei` / `bora` (inicia sessão) e `fim 45230` / `parei` (encerra sessão).
- **Gestão de Pausas:** `pausa` (pausa agora), `voltei` / `fim da pausa` (retoma), `pausa 12:00` (com horário específico) ou `pausa 20min` (retroativa: calcula início há 20 min e encerramento imediato).

### 3.2. Odômetro Inteligente e Recomposição de 3 Dígitos (`lib/odo.js` & `public/js/utils/odometer.js`)
- Motoristas costumam anotar apenas os últimos 3 dígitos do hodômetro no WhatsApp (ex.: manda `469` quando o carro está em `55469`).
- A função `completeOdo(partial, ref)` recompõe o valor total com base no último hodômetro registrado para aquele carro.
- Trata viradas de milhar com janela de ±500 km (ex.: referência em `55990` com leitura `005` vira `56005`).
- Interpolação na Tabela: quando uma corrida não tem hodômetro explícito, a função `computeAllOdometersAndTimes` estima a quilometragem e o tempo entre corridas, exibindo badge indicativa `est.` na interface.

### 3.3. Gestão de Veículos e Custos Dinâmicos (`public/js/services/car-service.js`)
- Cada carro cadastrado pode ser `alugado` (com periodicidade semanal, mensal ou diária) ou `proprio`.
- **Custo Fixo:** O valor do aluguel é decomposto em custo diário (`aluguelDia`).
- **Custo Variável (Combustível):** Calculado dinamicamente examinando os abastecimentos lançados e a quilometragem percorrida nos últimos 30 dias. Caso não haja dados suficientes, usa o consumo médio (`km/l`) e o preço do combustível configurado no cadastro do veículo.
- As anotações vinculam o carro automaticamente nas linhas através da anotação `[🚗 PLACA]`.

### 3.4. Controle de Sessão e Meta Calculada (`public/js/services/metrics-service.js`)
- Ao iniciar uma sessão, a aplicação calcula a meta bruta sugerida através da fórmula:
  $$\text{Meta Bruta} = \frac{\text{Meta de Lucro Desejada} + \text{Custo Fixo Diário}}{1 - (\text{Custo do Combustível por Km} / \text{Receita Média por Km})}$$
- O painel exibe: Lucro Médio Real da sessão, Rendimento por Hora ($R\$/h$), Rendimento por Km ($R\$/km$) e barra de progresso em tempo real.
- As pausas ativas são descontadas com precisão do cálculo de horas trabalhadas da sessão.

### 3.5. Tabela Customizável com Drag & Drop (`public/js/components/table.js` & `column-modal.js`)
- Suporta 15 colunas opcionais (Data/Hora, Ícone, Carro, Odômetro, Tempo Rodado, Passageiro, Editar, Valor Bruto, Lucro Estimado, Km Rodado, Categoria, Observações, R$/h, Subtotal do Dia, Ações).
- As colunas padrão iniciais são exatamente 7: Data/Hora, Ícone, Carro, Odômetro, Tempo rodado, Nome passageiro e Editar.
- Usuário pode reordenar por drag-and-drop ou botões subir/descer, salvando preferências no `localStorage` e `sessionStorage`.

---

## 4. Mapeamento Arquivo por Arquivo

Abaixo está o detalhamento da responsabilidade de cada arquivo presente no repositório.

### 4.1. Raiz do Projeto
| Arquivo | Descrição |
|---|---|
| `package.json` | Configura o projeto Node.js (`"type": "module"`), scripts (`dev`, `start`, `test`, `build:css`, `watch:css`) e dependências de build (Tailwind CSS v4 CLI e fontes). |
| `server.js` | Servidor HTTP nativo em Node.js (`node:http`) para desenvolvimento e deploy tradicional. Carrega variáveis de `.env`, serve estáticos de `public/` com tipos MIME, previne path traversal e roteia requisições `/api/*`. |
| `vercel.json` | Configuração de deploy da Vercel, definindo `public/` como diretório de saída estático e cabeçalhos de cache para assets. |
| `.env.example` | Template de variáveis de ambiente (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN`, `WA_GROUP_NAME`, `WA_GROUP_ID`). |
| `.env` | Arquivo local com credenciais ativas do banco e tokens de autenticação (ignorado pelo Git). |
| `README.md` | Guia rápido de instalação, deploy, exemplos de comandos aceitos e instruções do script Tampermonkey. |
| `index.md` | Este documento de arquitetura e diretrizes. |

### 4.2. Backend e Bibliotecas (`/lib`)
| Arquivo | Descrição |
|---|---|
| `lib/db.js` | Cliente REST do Supabase em JavaScript puro (sem SDK). Implementa `sb(path, options)` com `fetch` nativo, tratamento de cabeçalhos de autenticação e preferência de retorno. Fornece métodos `insert(rows, merge)`, autenticador `authed(req)` via token, `readBody(req)` e helper `send(res, code, data)`. |
| `lib/odo.js` | Lógica de negócio de hodômetro no backend. Contém `completeOdo(partial, ref)` para recompor números de 3 dígitos, regex de extração `rawOdo(r)`, identificador de veículo `carOf(r)`, busca do último odômetro `lastFullOdo(sb, carTag)` e sanitização das linhas antes de gravar no banco `fixOdoRows(rows, sb, carTag)`. |
| `lib/parse.js` | Parser de linguagem natural das mensagens. Mapeia palavras-chave para categorias de despesas (`DESP`), detecta comandos de início/fim de sessão, pausas com duração retroativa (`pausa 20min`), extrai horários, valores monetários, passageiro e quilômetros de corrida. |

### 4.3. Endpoints Serverless (`/api`)
| Arquivo | Descrição |
|---|---|
| `api/config.js` | Endpoint GET/POST para recuperar e persistir o registro único de configurações (`config?id=eq.1`), contendo metas, lista de carros e veículo ativo. |
| `api/entries.js` | Endpoint principal de lançamentos. Suporta `GET` com filtro de dias (`?days=60`), `POST` (interpretando texto livre via `parseText` ou objeto estruturado `row`), `PATCH ?id=` (para atualizações e vinculação de carro) e `DELETE ?id=`. |
| `api/uber.js` | Webhook receptor das viagens coletadas do painel do motorista (drivers.uber.com). Trata preflight `OPTIONS` com CORS, converte dados das viagens em linhas de ganho com `origem: 'uber'` e `ext_id: 'uber:UUID'`, atualizando valores se gorjetas chegarem depois. |
| `api/whatsapp.js` | Webhook para conectores do WhatsApp (Z-API, Evolution API v2, WAHA ou payload genérico). Filtra pelo ID ou nome do grupo configurado, processa as mensagens pelo parser, completa odômetros de 3 dígitos e salva com `origem: 'whatsapp'`. |
| `api/evolution.js` | Endpoint de integração com a Evolution API. Permite consultar status da conexão, solicitar/gerar QR Code para pareamento do WhatsApp, configurar o webhook automaticamente e desconectar instâncias. |

### 4.4. Banco de Dados (`/supabase`)
| Arquivo | Descrição |
|---|---|
| `supabase/schema.sql` | Script SQL DDL para criar as tabelas `lancamentos` (com restrições de tipo, colunas monetárias e índice descendente em `ts`) e `config` (registro JSONB singleton com id=1). Habilita Row Level Security (RLS) para proteger acesso direto do navegador. |

### 4.5. Estilos e Assets (`/src` e `/public`)
| Arquivo | Descrição |
|---|---|
| `src/styles.css` | Fonte principal de estilos compilada pelo Tailwind v4 CLI. Define tokens de tema `@theme` (paleta Void, Carbon, Graphite, Volt, Mint, Alert), aliases legados para compatibilidade com o JS (`--bg`, `--card`, `--tx`, `--ac`, etc.) e estilização de badges, modais e componentes. |
| `public/css/app.css` | Folha de estilo minificada gerada a partir do `src/styles.css`. |
| `public/css/styles.css` | Arquivo legado mantido como fallback. |
| `public/fonts/*` | Fontes woff2 locais para funcionamento offline sem dependência de CDN externa: `inter.woff2`, `jetbrains-mono.woff2`, `space-grotesk.woff2`. |
| `public/icon.svg` | Ícone vetorial da marca do app (PWA e favicon). |
| `public/manifest.webmanifest` | Manifesto PWA (nome, tema escuro, modo standalone). |
| `public/index.html` | Estrutura HTML da aplicação de página única (SPA). Contém as 4 abas (`#t-lista`, `#t-graf`, `#t-ins`, `#t-cfg`), barra de navegação inferior, botões FAB, filtros de data, barra de sessão e todos os modais `<dialog>`. |
| `public/evolution.html` | Página de conexão e gerenciamento da Evolution API (WhatsApp). Exibe QR Code em tempo real, estado da conexão, permite configurar webhook automático e gerenciar instâncias. |
| `public/uber-sync.user.js` | Userscript para Tampermonkey/Violentmonkey. Monitora chamadas de rede no painel web da Uber (`drivers.uber.com`), localiza objetos de corridas em qualquer JSON recebido e despacha para `/api/uber`. |

### 4.6. Frontend Modular (`/public/js`)

#### Ponto de Entrada e Comunicação
| Arquivo | Descrição |
|---|---|
| `public/js/app.js` | Ponto de entrada (entry point) da aplicação. Importa módulos, inicializa event listeners de todos os componentes e modais, gerencia o ciclo de vida da store, sincronização remota (`loadData`) e pooling de foco de tela. |
| `public/js/api/client.js` | Camada de abstração HTTP do frontend. Encapsula `fetch` para `/api/*`, incluindo suporte a prompt de token quando recebe HTTP 401 e armazenamento local em `localStorage.tk`. Fornece `fetchEntries`, `fetchConfig`, `saveConfigApi`, `createEntryApi`, `updateEntryApi` e `deleteEntryApi`. |

#### Gerenciador de Estado (Store)
| Arquivo | Descrição |
|---|---|
| `public/js/state/store.js` | Store central reativa da aplicação. Guarda `rows`, `cfg`, `metrics`, `filter`, `visibleCols` e `columnOrder`. Gerencia persistência síncrona com `localStorage`, `sessionStorage` e objeto global `sessionUser`. Implementa sistema de listeners com proteção contra loop recursivo de renderização. |

#### Utilitários (`/public/js/utils`)
| Arquivo | Descrição |
|---|---|
| `public/js/utils/constants.js` | Define configurações e valores padrão (`DEF`), abreviações de dias da semana (`DS`), lista exaustiva de colunas (`ALL_COLUMNS`), ícones de categoria (`CAT_ICONS`) e rótulos (`CAT_LABELS`). |
| `public/js/utils/format.js` | Helpers puros de formatação: seletor DOM `$()`, formatação monetária `R()` e `R0()`, números decimais `N1()`, zero à esquerda `pad()`, chave de data `dk()`, horário `hm()`, início da semana `weekStart()`, escape HTML `esc()` e parser numérico `parseNum()`. |
| `public/js/utils/odometer.js` | Utilitários de hodômetro no client-side. Reconstitui valores de 3 dígitos com base na última leitura do mesmo carro e prepara os dados para renderização na tabela. |

#### Serviços (`/public/js/services`)
| Arquivo | Descrição |
|---|---|
| `public/js/services/autonomia-service.js` | Motor de cálculo de consumo e autonomia. Em sessões ativas, calcula a média de km/l do carro, estima o odômetro atual, verifica o último abastecimento e estima em quanto tempo médio e quantos km será necessário abastecer novamente com base na velocidade média de trabalho. |
| `public/js/services/car-service.js` | Serviço de regras de negócio de veículos. Busca lista de carros, carro ativo, realiza regex para extrair placa de notas, calcula custos dinâmicos (aluguel fixo + combustível variável) e persiste alterações no backend. |
| `public/js/services/entries-service.js` | Serviço de manipulação de lançamentos. Cria, atualiza e remove lançamentos, manipulando o estado local otimista e exibindo notificações Toast de feedback. |
| `public/js/services/metrics-service.js` | Motor de cálculo analítico e telemetria. Agrega lançamentos por dia, detecta sessões ativas e passadas, desconta intervalos de pausa, interpola odômetros e tempos entre corridas, calcula meta de sessão sugerida e gera projeções do dia e da semana. |

#### Componentes Visuais (`/public/js/components`)
| Arquivo | Descrição |
|---|---|
| `public/js/components/car-bar.js` | Renderiza o seletor rápido de carro ativo no topo do modal de lançamento e a lista completa de carros na aba de configurações. |
| `public/js/components/charts.js` | Renderiza os gráficos estatísticos da aba de gráficos (faturamento diário, rendimento por hora e heatmap de produtividade por faixa de horário). |
| `public/js/components/date-filter.js` | Controla os chips de filtro rápido de período (Hoje, Ontem, Semana, 7d, Mês, 30d, Todos, Custom) e atualiza o resumo do cabeçalho da tabela. |
| `public/js/components/entry-forms.js` | Manipula o envio dos formulários de entrada rápida (NLP) e formulário detalhado, disparando chamadas ao `entries-service`. |
| `public/js/components/insights.js` | Gera cards de insights inteligentes na aba de Insights (melhores horários, eficiência por km, análise de custos do veículo e alertas operacionais). |
| `public/js/components/kpi-summary.js` | Renderiza o resumo de métricas principais (faturamento diário, projeções, $R\$/h$, $R\$/km$, número de corridas e lucro líquido). |
| `public/js/components/navigation.js` | Gerencia a troca de abas da navegação inferior (Lançamentos, Gráficos, Insights e Carros & Metas). |
| `public/js/components/parcial-report.js` | Componente de relatório parcial do dia com ProgressBar enriquecida mostrando exatamente os marcadores de **Break-even**, **Lucro do Dia** e **Meta de Caixas**, além do card de autonomia de combustível quando a sessão está ativa. |
| `public/js/components/quick-events.js` | Barra horizontal no topo da tela de lançamentos com botões redondos de eventos (Pausa, Água, Banheiro, Comida e Descanso). Cada botão possui um timer contínuo e mecanismo de pressão contínua (long-press de 5 segundos) com feedback de anel SVG que reseta a contagem e registra o evento. |
| `public/js/components/session-card.js` | Renderiza o card operacional de turno ativo/pausado, barra de progresso em relação à meta da sessão, alerta de autonomia e botões de Iniciar, Pausar/Retomar e Encerrar. |
| `public/js/components/table.js` | Constrói a tabela de lançamentos respeitando a ordem e visibilidade das colunas definidas pelo usuário, exibindo badges de odômetro estimado e botão de edição rápida. |
| `public/js/components/toast.js` | Componente de notificação flutuante com auto-dispensa para mensagens de sucesso ou erro. |

#### Modais (`/public/js/components/modals`)
| Arquivo | Descrição |
|---|---|
| `public/js/components/modals/add-entry-modal.js` | Abre e fecha o modal flutuante de criação de lançamento disparado pelo botão FAB (+), alternando entre modo rápido e detalhado. |
| `public/js/components/modals/car-modal.js` | Modal para criação e edição de veículos, campos de placa, aluguel, consumo médio e preço do combustível. |
| `public/js/components/modals/car-select-modal.js` | Modal de troca rápida de veículo em uso com um clique. |
| `public/js/components/modals/column-modal.js` | Modal contextual para selecionar quais colunas aparecem na tabela e reordená-las via botões ou drag-and-drop. |
| `public/js/components/modals/edit-modal.js` | Modal de edição e exclusão de lançamentos ao clicar no ícone de lápis (✏️). |
| `public/js/components/modals/start-session-modal.js` | Modal disparado ao iniciar uma sessão, apresentando o cálculo dinâmico da meta sugerida com base no lucro líquido alvo e permitindo ajuste do odômetro inicial. |

### 4.7. Testes Automatizados (`/test`)
| Arquivo | Descrição |
|---|---|
| `test/test-server.js` | Testa o interpretador de frases `parseLine`/`parseText` e sobe uma instância real do servidor `server.js` em porta aleatória para verificar rotas de arquivos estáticos, rotas de API, CORS e tratamento de 404. |
| `test/test-modules.js` | Bateria profunda de testes cobrindo formatadores, constantes, métricas de sessão, serviços de veículos, persistência de colunas na store e renderização de células da tabela. |
| `test/test-odo.js` | Testes específicos da lógica de hodômetro de 3 dígitos, virada de milhar e recomposição com a última leitura do banco. |
| `test/test-pausas.js` | Testa a interpretação de comandos de pausa (`pausa`, `voltei`, `pausa 20min`), desconto correto nas métricas de turno e tratamento de pausas ativas. |
| `test/test-autonomia.js` | Testa o cálculo de consumo km/l, projeção do próximo abastecimento, tempo restante em sessão ativa, botões rápidos com timers e barra do relatório parcial. |

---

## 5. Diretrizes para Agentes de IA

Ao realizar qualquer alteração, refatoração ou adição de funcionalidade nesta base de código, os agentes de IA **DEVEM** seguir rigorosamente as regras abaixo:

### ⚠️ Regra 1: Zero Dependências em Runtime (No Bloatware)
- **NÃO** instale bibliotecas como Express, Axios, Lodash, Moment, Dayjs, Date-fns, Supabase-JS ou frameworks frontend (React, Vue, Svelte).
- Todas as requisições HTTP do backend devem utilizar a função nativa `fetch` do Node.js 18+.
- As chamadas ao banco devem passar exclusivamente pelo helper `sb()` de `lib/db.js` ou por funções nativas do banco PostgREST.
- O frontend deve continuar sendo estritamente Vanilla JavaScript com ES Modules nativos.

### ⚠️ Regra 2: Compatibilidade Dual Backend (Node.js Nativo + Vercel Serverless)
- Cada arquivo dentro de `/api/*.js` deve exportar por padrão uma função no formato `export default async function handler(req, res)`.
- O `server.js` emula os métodos `res.status(code)` e `res.json(data)`. Mantenha essa assinatura compatível.
- Nunca faça chamadas a módulos específicos de Vercel que quebrem o `server.js` local.

### ⚠️ Regra 3: Sistema de Design, Tokens e Estilização
- O CSS é processado via Tailwind CSS v4 CLI a partir de `src/styles.css`.
- Ao alterar estilos visuais, edite `src/styles.css` e execute `npm run build:css` para atualizar `public/css/app.css`.
- **NUNCA** remova os aliases legados (`--bg`, `--card`, `--tx`, `--ac`, `--ac2`, `--warn`, `--bad`), pois o JavaScript da aplicação e componentes como gráficos e células os utilizam para estilos inline e renderizações de SVG/Canvas.
- Lembre-se que elementos com atributo `[hidden]` utilizam `display: none !important;` para assegurar fechamento imediato de modais e menus contextuais.

### ⚠️ Regra 4: Gestão do Odômetro e Regex de Carros
- O odômetro pode vir com 3 dígitos vindo do WhatsApp. Use sempre `completeOdo` ou `fixOdoRows` para garantir que o banco guarde o odômetro completo ou `null` quando não houver referência.
- A vinculação de carro em lançamentos do WhatsApp ou da app é padronizada como `[🚗 PLACA]`. Ao alterar ou limpar anotações (`obs`), preserve ou trate a tag usando `getRowCar` e `getRowObs`.

### ⚠️ Regra 5: Sincronização de Estado na Store Reativa
- A store (`public/js/state/store.js`) notifica ouvintes via `store.subscribe()`.
- O método `store.setMetrics()` **NÃO** dispara notificações para evitar loops recursivos de renderização durante o ciclo de cálculo de métricas.
- Qualquer nova configuração de preferência do usuário na tabela deve ser persistida tanto no `localStorage` quanto no `sessionStorage` e no objeto `window.sessionUser`.

### ⚠️ Regra 6: Fuso Horário e Datas
- O aplicativo opera primariamente no fuso de São Paulo (`America/Sao_Paulo`, UTC-3).
- O parser `lib/parse.js` adota o offset `-3` ao converter horários soltos no formato `HH:MM`. Caso o horário seja ligeiramente futuro (mais de 10 minutos à frente), ele é interpretado como do dia anterior.
- No banco de dados, todas as colunas temporais são salvas em `timestamptz` no formato UTC ISO 8601 (`now.toISOString()`).

### ⚠️ Regra 7: Validação e Testes Obrigatórios
- Antes de considerar qualquer tarefa finalizada, execute:
  ```bash
  npm test
  ```
- Todos os 5 arquivos de teste (`test-server.js`, `test-modules.js`, `test-odo.js`, `test-pausas.js`, `test-autonomia.js`) devem passar com **0 falhas**. Se você criar uma nova regra de negócio ou alterar o parser, crie os testes correspondentes na pasta `test/`.

---

## 6. Fluxo de Desenvolvimento e Comandos Úteis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia o servidor Node.js com auto-reload (`node --watch server.js`) em `http://localhost:3000`. |
| `npm start` | Inicia o servidor em modo produção. |
| `npm test` | Executa a suíte completa de testes automatizados. |
| `npm run build:css` | Compila e minifica `src/styles.css` gerando `public/css/app.css` via Tailwind CLI. |
| `npm run watch:css` | Observa alterações em `src/styles.css` e recompila continuamente. |

---

*Documentação mantida e atualizada para garantir autonomia e precisão a qualquer desenvolvedor ou agente autônomo atuando no projeto.*
