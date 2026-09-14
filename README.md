# KP-4DSM-API — Sistema de Monitoramento e Alertas de Desastres Naturais

## Equipe Kernel Panic

<div align="center">

![Defesa Civil](https://img.shields.io/badge/Defesa%20Civil-Sistema%20de%20Alertas-blue)
![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow)
![Sprint](https://img.shields.io/badge/Sprint-1-green)

[A Dor do Cliente](#a-dor) | 
[A Solução](#a-solução) |
[O Desafio](#o-desafio) | 
[Backlog de Produto](#backlog-de-produto) | 
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

<a id="backlog-de-produto"></a>
## 📋 Backlog de Produto

| ID | User Story | Épico | Prioridade | Pontos | Status |
|----|-----------|-------|-----------|--------|--------|
| US01 | Gestão de Usuários, Autenticação e Níveis de Acesso | Governança & Segurança | Alta | 11 | ⏳ |
| US02 | Cadastro e Gerenciamento Dinâmico de Estações e Sensores | Infraestrutura & Modelo Dinâmico | Alta | 11 | ⏳ |
| US03 | Coleta e Transmissão via Datalogger Físico | IoT & Recepção de Dados | Alta | 13 | ⏳ |
| US04 | Serviço de Recepção, Validação e Persistência de Telemetria | IoT & Recepção de Dados | Alta | 10 | ⏳ |
| US05 | Dashboard Interativo com Filtros e Indicadores Estatísticos | Monitoramento Operacional | Alta | 12 | ⏳ |
| US06 | Parametrização, Detecção e Histórico de Alertas de Risco | Gestão de Alertas | Alta | 16 | ⏳ |
| US07 | Trilha de Auditoria Forense e Rastreabilidade | Interoperabilidade & Auditoria | Alta | 13 | ⏳ |
| US08 | Disponibilização de Dados Abertos e Interoperabilidade (e-PING) | Interoperabilidade & Auditoria | Alta | 13 | ⏳ |
| US09 | Relatório de Histórico e Condições Climáticas Consolidadas | Relatórios Analíticos | Média | 9 | ⏳ |
| US10 | Relatório de Incidentes e Ocorrências de Alertas | Relatórios Analíticos | Média | 9 | ⏳ |
| US11 | Relatório Estatístico e Análise Comparativa | Relatórios Analíticos | Média | 9 | ⏳ |

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
git clone https://github.com/yourusername/KP-4DSM-API.git
cd KP-4DSM-API
```

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
- [Mapeamento de Requisitos](https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API/blob/main/docs/Mapeamento%20de%20Requisitos%20-%20Kernel%20Panic.pdf)