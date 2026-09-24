# KP-4DSM-API — Sistema de Monitoramento e Alertas de Desastres Naturais

## Equipe Kernel Panic

<div align="center">

![Defesa Civil](https://img.shields.io/badge/Defesa%20Civil-Sistema%20de%20Alertas-blue)
![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow)
![Sprint](https://img.shields.io/badge/Sprint-1-green)

[A Dor do Cliente](#a-dor) | 
[A Solução](#a-solução) |
[O Desafio](#o-desafio) | 
[DoR](#dor) |
[DoD](#dod) | 
[Backlog de Produto](#backlog-de-produto) | 
[Backlog da Sprint](#backlog-da-sprint) | 
[Tecnologias](#tecnologias-utilizadas) |
[Estrutura do Projeto](#estrutura-do-projeto) | 
[Instalação](#manual-de-instalação) | 
[Equipe](#autores)

</div>

---

<a id="a-dor"></a>
## 🎯 A Dor do Cliente

A Defesa Civil enfrenta desafios críticos na prevenção e resposta a desastres naturais:

- **Falta de visibilidade em tempo real** sobre condições meteorológicas em múltiplas regiões
- **Monitoramento fragmentado** com dados de diferentes fontes não integradas
- **Atrasos na detecção de anomalias** que levam a perda de vidas e danos materiais
- **Impossibilidade de correlacionar eventos** entre estações para identificar padrões de risco
- **Falta de auditoria e rastreabilidade** dos dados meteorológicos para fins legais e de compliance (LGPD)
- **Indisponibilidade de dados abertos** para integração com sistemas estaduais e federais

Impacto: Sem visibilidade consolidada sobre os parâmetros meteorológicos críticos e alertas automáticos, a instituição sofre com resposta lenta a emergências, falta de confiança nos dados e dificuldade em coordenar ações com outros órgãos governamentais.

---

<a id="a-solução"></a>
## 🚀 A Solução

O **KP-4DSM-API** é uma plataforma integrada de monitoramento e alerta de desastres naturais que centraliza:

### Componentes principais:

1. **Gestão de Infraestrutura**
   - CRUD de estações meteorológicas com sensores dinâmicos (pluviômetro, anemômetro, termômetro, etc.)
   - Parametrização flexível para diferentes combinações de hardware de baixo custo

2. **Coleta e Ingestão de Dados**
   - Recepção de dados via datalogger físico (ESP32 e similares)
   - Validação e persistência em banco otimizado para séries temporais
   - Buffer e retentativa em caso de falhas transitórias

3. **Monitoramento em Tempo Real**
   - Dashboard interativo com gráficos em tempo real e históricos
   - Filtros temporais e por localização/estação
   - Indicadores estatísticos (médias móveis, máximos, mínimos, desvio padrão)

4. **Sistema de Alertas**
   - Parametrização de gatilhos por condições meteorológicas críticas
   - Níveis de severidade (Atenção, Alerta, Emergência)
   - Disparo automático de notificações ao painel
   - Histórico completo de ocorrências para auditoria

5. **Relatórios Analíticos**
   - Relatório de histórico climático consolidado
   - Relatório de incidentes e ocorrências de alertas
   - Análise comparativa entre estações com métricas estatísticas

6. **Interoperabilidade Governamental**
   - API estruturada em padrões abertos (OpenAPI/Swagger)
   - Conformidade com e-PING para integração com órgãos federais e estaduais
   - Dados abertos em JSON e CSV

---

<a id="o-desafio"></a>
## 🧩 O Desafio Proposto

Desenvolver uma aplicação web full-stack que integre coleta de dados meteorológicos de múltiplas estações, processamento em tempo real, detecção automática de anomalias e disponibilização de dados para órgãos governamentais.

A solução combina:
- **Backend**: NestJS com Prisma para modelagem dinâmica
- **Frontend**: Next.js com interface responsiva
- **Banco de Dados**: Otimizado para séries temporais
- **Conformidade**: LGPD e e-PING para setor público

---

<a id="dor"></a>
- US definida com seus requisitos necessários e caso de uso
- Estar descrito como a task deve ser entregue para ser considerada aceita
- Fazer mockups se aplicável
- Regras de negócio documentadas e validadas
- Cenários de sucesso/erro bem definidos para as US
- US possuem prioridade definida
- Não existem bloqueios conhecidos para iniciar o desenvolvimento
- RF (requisito funcional) e RNF (requisito não funcional) relevantes bem identificados

---

<a id="dod"></a>
- Cumprir todos critérios de aceitação definidos pela US
- Seguir padrões de commit, branches, arquitetura e etc
- Garantir que alterações/implementações no código não tenham causado regressões em funcionalidades já existentes
- Atualizar a documentação técnica e/ou funcional quando aplicável
- Não podem existem pendências, bloqueios ou ações obrigatórias relacionadas à entrega de uma task

---

<a id="backlog-de-produto"></a>
## 📋 Backlog de Produto

| ID | User Story | Critérios de Aceitação | Prioridade | Sprint | Pontos | Status |
|----|-----------|-------|-----------|--------|--------|--------|
| US01 | Gestão de Usuários, Autenticação e Níveis de Acesso | - Autenticação por credenciais com geração de token seguro (JWT/Sessão). - Disponibilização de dois perfis: Administrador (gestão total de estações, alertas e usuários) e Público (acesso somente leitura a dados agregados). - Armazenamento de senhas com algoritmo criptográfico robusto e controle de acesso restrito a dados pessoais em conformidade com a LGPD.| Alta | 1 | 11 | ✅ |
| US02 | Cadastro e Gerenciamento Dinâmico de Estações e Sensores | - CRUD completo de estações contendo identificador único (UUID/MAC), coordenadas geográficas (latitude/longitude), endereço/região e status operacional. - Modelo de dados dinâmico permitindo vincular sensores específicos a cada estação (pluviômetro, anemômetro, termômetro, barômetro, higrômetro) com suas respectivas unidades de medida. - Interface de listagem e busca por região, status e tipo de parâmetro instalado. | Alta | 1 | 11 | ⏳ |
| US03 | Coleta e Transmissão via Datalogger Físico | - Leitura precisa dos sensores conectados (ex.: ESP32). - Montagem de payload padronizado. - Mecanismo de buffer/retentativa em caso de falha transitória de comunicação com a rede de envio. | Alta | 3 | 13 | ⏳ |
| US04 | Serviço de Recepção, Validação e Persistência de Telemetria | - Endpoint de ingestão de dados com alta disponibilidade e resposta rápida aos nós sensores. - Persistência histórica garantindo imutabilidade dos dados originais associados à estação e momento exato de recebimento. | Alta | 3 | 10 | ⏳ |
| US05 | Dashboard Interativo com Filtros e Indicadores Estatísticos | - Gráficos em tempo real e históricos dos parâmetros (volume de chuva acumulado, rajadas de vento, temperatura e umidade). - Filtros por período selecionável (últimas 24h, 7 dias, mês ou intervalo customizado) e por estação/localização. - Exibição de síntese estatística calculada automaticamente: médias móveis, valores máximos, mínimos e desvio padrão. | Alta | 1 | 12 | ⏳ |
| US06 | Parametrização, Detecção e Histórico de Alertas de Risco | - CRUD alerta associando parâmetros, e níveis de severidade (ex.: Atenção, Alerta, Emergência). - Disparo de alerta automático no painel assim que um pacote recebido violar um limiar configurado. - Módulo de consulta de histórico de alertas permitindo rastrear data, hora, estação afetada, parâmetro violado e status do evento. | Alta | 1 | 16 | ⏳ |
| US07 | Trilha de Auditoria Forense e Rastreabilidade | Persistência de logs para auditoria. | Alta | 1 | 13 | ⏳ |
| US08 | Disponibilização de Dados Abertos e Interoperabilidade (e-PING) | - Documentação completa da API via OpenAPI/Swagger com descrição de endpoints, schemas de dados e exemplos funcionais. - Disponibilização de rotas públicas de exportação em JSON e CSV com dados consolidados. - Aderência às diretrizes de arquitetura de dados e-PING para o setor público. | Alta | 3 | 13 | ⏳ |
| US09 | Relatório de Histórico e Condições Climáticas Consolidadas | - Seleção flexível de período, granularidade temporal (horária/diária) e seleção de estações específicas. - Apresentação tabular e gráfica com totalizadores (ex.: acumulado pluviométrico diário). - Exportação nos formatos PDF e CSV para inclusão em processos administrativos. | Média | 2 | 9 | ⏳ |
| US10 | Relatório de Incidentes e Ocorrências de Alertas | - Filtro por severidade do alerta, período da ocorrência e região geográfica afetada. - Discriminação do parâmetro que superou o limiar de risco, tempo de duração da anomalia e ações correlacionadas. - Emissão de laudo consolidado para anexação a decretos municipais/estaduais de emergência. | Média | 2 | 9 | ⏳ |
| US11 | Relatório Estatístico e Análise Comparativa | - Comparação lado a lado entre duas ou mais estações para identificação de discrepâncias locais. - Cálculo de métricas de dispersão e tendência central (desvio padrão, variância, mediana e quartis). - Exportação com sumário executivo visual e tabelas de síntese estatística. | Média | 2 | 9 | ⏳ |

---

<a id="backlog-da-spint"></a>
## 📋 Backlog da Sprint
| ID | User Story | Épico | Prioridade | Sprint | Pontos | Status | Meta da Sprint |
|----|-----------|-------|-----------|--------|--------|--------|----------------|
| US01 | Gestão de Usuários, Autenticação e Níveis de Acesso | Governança & Segurança | Alta | 1 | 11 | ✅ | Meta |
| US02 | Cadastro e Gerenciamento Dinâmico de Estações e Sensores | Infraestrutura & Modelo Dinâmico | Alta | 1 | 11 | ⏳ | Meta |
| US05 | Dashboard Interativo com Filtros e Indicadores Estatísticos | Monitoramento Operacional | Alta | 1 | 12 | ⏳ | Meta |
| US06 | Parametrização, Detecção e Histórico de Alertas de Risco | Gestão de Alertas | Alta | 1 | 16 | ⏳ | Meta |
| US07 | Trilha de Auditoria Forense e Rastreabilidade | Interoperabilidade & Auditoria | Alta | 1 | 13 | ⏳ | Não é meta |

---

<a id="tecnologias-utilizadas"></a>
## 💻 Tecnologias Utilizadas

### 🎨 Frontend
<p>
<img src="https://cdn.simpleicons.org/typescript/3178C6" height="32"/>
<img src="https://cdn.simpleicons.org/react/61DAFB" height="32"/>
<img src="https://cdn.simpleicons.org/tailwindcss/06B6D4" height="32"/>
<img src="https://cdn.simpleicons.org/nodedotjs/339933" height="32"/>
</p>

### ⚙️ Backend
<p>
<img src="https://cdn.simpleicons.org/nestjs/E0234E" height="32"/>
<img src="https://cdn.simpleicons.org/typescript/3178C6" height="32"/>
<img src="https://cdn.simpleicons.org/prisma/2D3748" height="32"/>
<img src="https://cdn.simpleicons.org/nodedotjs/339933" height="32"/>
</p>

### 📊 Dados & DevOps
<p>
<img src="https://cdn.simpleicons.org/postgresql/336791" height="32"/>
<img src="https://cdn.simpleicons.org/git/F05032" height="32"/>
<img src="https://cdn.simpleicons.org/github/4B4B4B" height="32"/>
</p>

---

<a id="estrutura-do-projeto"></a>
## 🗂️ Estrutura do Projeto

```
KP-4DSM-API
│
├── 📁 frontend/               → Aplicação Next.js
│   ├── 📁 app/               → Páginas e rotas
│   │   ├── 📁 (protegido)/   → Rotas autenticadas
│   │   │   └── 📁 usuarios/
│   │   └── 📁 login/         → Página de login
│   ├── 📁 components/        → Componentes React reutilizáveis
│   ├── 📁 lib/               → Utilitários e serviços API
│   └── 📁 public/            → Arquivos estáticos
│
└── 📁 kernelpanic-backend/    → API NestJS
    ├── 📁 src/
    │   ├── 📁 autenticacao/   → Autenticação e JWT
    │   ├── 📁 usuarios/       → Gestão de usuários
    │   ├── 📁 prisma/         → Configuração do Prisma
    │   └── 📁 main.ts         → Ponto de entrada
    ├── 📁 prisma/
    │   ├── schema.prisma      → Modelo de dados
    │   ├── seed.ts            → Seed de dados
    │   └── 📁 migrations/      → Histórico de migrações
    └── 📁 test/               → Testes E2E
```

---

<a id="manual-de-instalação"></a>
## 📖 Manual de Instalação

### 🔧 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- PostgreSQL 14+
- Git

### 📦 Clonando o repositório

```bash
git clone https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API.git
cd KP-4DSM-API
npm install   # ferramentas de commit da raiz; também ativa o hook de validação
```

### 📝 Fazendo commits

Os commits seguem o formato `tipo(escopo): resumo`, que a CI valida em todo PR
(ver [padrão de commit](https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API/wiki/Dev-Padrao-de-commit)).
Para montar a mensagem no padrão, adicione as mudanças ao stage e rode, na raiz, no
`kernelpanic-backend/` ou no `frontend/frontend/`:

```bash
git add <arquivos>
npm run commit
```

O comando pergunta o tipo, o escopo (`US06-02`, `#39` ou `not-US`) e o resumo. Commits
feitos direto com `git commit` também são validados pelo hook `commit-msg`, que recusa
mensagens fora do padrão antes de o commit ser criado. Se a mensagem for recusada,
`npx cz --retry` na raiz refaz o commit com as respostas anteriores.

---

<a id="autores"></a>
## 👨‍💻 Autores

Equipe de Desenvolvimento 4DSM - FATEC São José dos Campos

| Nome | Função | Contato |
|------|--------|--------|
| [Rebeca Lima] | Product Owner | [GitHub](https://github.com/rebeca-lima-ti) |
| [Vitor Serpa] | Scrum Master | [GitHub](https://github.com/VitorSerpa) |
| [Gabriel Lázaro] | Desenvolvedor | [GitHub](https://github.com/gabsact4) |
| [Henry Tito] | Desenvolvedor | [GitHub](https://github.com/HenryTito) |
| [Miguel Nonaka] | Desenvolvedor | [GitHub](https://github.com/miguelnonaka) |
| [Maria Fernanda Laboissiere] | Desenvolvedor | [GitHub](https://github.com/mariaflbss) |
| [Paula Tamay] | Desenvolvedor | [GitHub](https://github.com/PaulaEmy/PaulaEmy) |
| [João Victor dos Reis] | Desenvolvedor | [GitHub](https://github.com/Templasan) |

---

## 📚 Documentação Adicional

- [Product Backlog Detalhado](https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API/blob/main/docs/Product%20Backlog%204%C2%BADSM%20-%20Kernel%20Panic.pdf)
- [Mapeamento de Requisitos](https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API/blob/main/docs/Requisitos.md)
