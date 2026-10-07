# Mapeamento e Especificação Técnica de Requisitos

Sistema de Coleta de Dados de Estações Meteorológicas

Cenário: Defesa Civil & Alertas de Desastres Naturais | Base: Requisitos de Cliente 4DSM 2026-2 Tecsus

### 1. Matriz de Rastreabilidade Consolidada

### 2. Fontes e Referências

- Requisitos de Cliente 4DSM 2026-2 Tecsus.
• Especificações de Interoperabilidade e-PING e Diretrizes Gerais da LGPD.

| Requisito / Necessidade | Origem do Requisito | Justificativa / Validação |
| --- | --- | --- |
| RF01 — Modelo Dinâmico | Cliente | Modelagem de dados permite novos sensores e grandezas sem alteração de schema. |
| RF02 — CRUD Geral | Cliente | Gestão completa de usuários, estações, parâmetros e limiares de alerta. |
| RF03 — Recepção de Dados | Cliente | Protocolo ponta a ponta: do envio via datalogger até a persistência otimizada. |
| RF04 — Dashboards | Cliente | Visualizações com filtros temporais, geográficos e agregação estatística. |
| RF05 — Geração de Alertas | Cliente | Disparo automatizado com baixa latência e relatórios circunstanciados de incidentes. |
| RF06 — Datalogger | Cliente | Firmware com temporização, leitura analógica/digital e buffer de resiliência. |
| RF07 — Relatórios Analíticos Obrigatórios | Cliente | Entrega de 3 relatórios analíticos distintos conforme exigência do parceiro. |
| RF08 — Gestão de Licitações e Contratos | Cliente | Gestão de contratos, órgãos públicos e vinculação de estações e sensores. |
| RNF09 — Usabilidade / UX | Cliente | Padrões de acessibilidade WCAG AA e tempo de carregamento definido (≤ 2s). |
| RNF10 — Documentação de API | Cliente | Especificação via OpenAPI 3.0 / Swagger com rotas documentadas e testáveis. |
| RNF11 — Padrões e-PING | Cliente | Formatos abertos (JSON/CSV) e interoperabilidade com sistemas governamentais. |
| RNF12 — LGPD & Auditoria | Cliente | Perfis de acesso restritos, senhas criptografadas e logs forenses imutáveis. |
| RT13 — Montagem Física | Equipe | Hardware especificado e integrado aos circuitos de amostragem e transmissão. |
| RT14 — Pipeline de CI | Cliente | Automação de testes e inspeção de código em Pull Requests. |
| RT15 — Deploy Automatizado / CD | Equipe | Implantação orientada a contêineres com custo eficiente (foco em ROI). |
