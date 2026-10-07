# Mapeamento e Especificação Técnica de Requisitos

Sistema de Coleta de Dados de Estações Meteorológicas

Cenário: Defesa Civil & Alertas de Desastres Naturais | Base: Requisitos de Cliente 4DSM 2026-2 Tecsus

### 1. Matriz de Rastreabilidade Consolidada

| Requisito / Necessidade | Origem do Requisito | Justificativa / Validação |
| --- | --- | --- |
| RF01 — Modelo Dinâmico | Cliente | Modelagem de dados permite novos sensores e grandezas sem alteração de schema. |
| RF02 — CRUD de Usuários | Cliente | Gestão completa de usuários e permissões. |
| RF03 — CRUD de Estações e Parâmetros | Cliente | Gestão completa de estações e parâmetros |
| RF04 — CRUD de alertas | Cliente | Gestão completa de alertas e limiares. |
| RF05 — Recepção de Dados | Cliente | Protocolo ponta a ponta: do envio via datalogger até a persistência otimizada. |
| RF06 — Dashboards | Cliente | Visualizações com filtros temporais, geográficos e agregação estatística. |
| RF07 — Geração de Alertas | Cliente | Disparo automatizado com baixa latência e relatórios circunstanciados de incidentes. |
| RF08 — Datalogger | Cliente | Firmware com temporização, leitura analógica/digital e buffer de resiliência. |
| RF09 — Relatórios Analíticos Obrigatórios | Cliente | Entrega de 3 relatórios analíticos distintos conforme exigência do parceiro. |
| RF10 — CRUD de Licitações e Contratos | Cliente | Gestão completa de contratos, órgãos públicos e vinculação de estações e sensores. |
| RNF11 — Usabilidade / UX | Cliente | Padrões de acessibilidade WCAG AA e tempo de carregamento definido (≤ 2s). |
| RNF12 — Documentação de API | Cliente | Especificação via OpenAPI 3.0 / Swagger com rotas documentadas e testáveis. |
| RNF13 — Padrões e-PING | Cliente | Formatos abertos (JSON/CSV) e interoperabilidade com sistemas governamentais. |
| RNF14 — LGPD & Auditoria | Cliente | Perfis de acesso restritos, senhas criptografadas e logs forenses imutáveis. |
| RNF15 — Documentação de Processos | Equipe | Armazenamento de todos os processos e fluxos seguidos no desenvolvimento. |
| RT16 — Montagem Física | Equipe | Hardware especificado e integrado aos circuitos de amostragem e transmissão. |
| RT17 — Pipeline de CI | Cliente | Automação de testes e inspeção de código em Pull Requests. |
| RT18 — Deploy Automatizado / CD | Equipe | Implantação orientada a contêineres com custo eficiente (foco em ROI). |

### 2. Fontes e Referências

- Requisitos de Cliente 4DSM 2026-2 Tecsus.
• Especificações de Interoperabilidade e-PING e Diretrizes Gerais da LGPD.