# Plano e Guia de QA & DevOps — Sistema de Coleta Meteorológica e Alertas (Defesa Civil)
Projeto Integrador 4º DSM (2026-2) | Equipe Kernel Panic | Parceiro: Tecsus


## 1. Objetivo do QA no Projeto
Garantir a confiabilidade, integridade e disponibilidade da plataforma de recepção de telemetria IoT e suporte a decisões críticas da Defesa Civil. Em cenários de desastres naturais (enchentes, deslizamentos e tempestades severas), a falha de um alerta ou a corrupção de dados climáticos pode colocar vidas em risco. O QA atua de forma preventiva em todas as etapas:
Requisitos (LGPD/e-PING) → Pipeline CI/CD → Ingestão IoT → Dashboards/Alertas → Homologação

## 2. Escopo dos Testes por Épico e Funcionalidade
US01 — Autenticação & LGPD: Segregação estrita entre perfis Administrador e Público. Proteção de dados de operadores (LGPD), hash de senhas e expiração/validação de tokens JWT.
US02 — Cadastro Dinâmico de Estações: Criação de estações com UUID/MAC, coordenadas geográficas válidas e amarração dinâmica a diferentes sensores (pluviômetro, anemômetro, termômetro, higrômetro, barômetro) e unidades de medida.
US03 & US04 — Datalogger & Ingestão IoT: Recepção contínua de telemetria via HTTP/REST; integridade de payloads; resiliência a quedas de rede do datalogger (buffer e retentativas); persistência imutável em série temporal.
US05 — Dashboard Operacional: Renderização e cálculo de indicadores estatísticos (médias móveis, desvio padrão, min/max); responsividade; consistência com dados reais em filtros temporais (24h, 7d, mês).
US06 — Parametrização & Alertas de Risco: Detecção instantânea quando medições violarem limiares configurados (Atenção, Alerta, Emergência); verificação do tempo entre a ingestão e o disparo na interface.
US07 & US08 — Auditoria & e-PING: Imutabilidade e persistência de trilhas de auditoria; aderência dos endpoints públicos aos padrões do e-PING; conformidade do contrato OpenAPI/Swagger e formatos JSON/CSV.
US09 a US11 — Relatórios Analíticos: Validação da exportação em PDF e CSV; integridade dos cálculos estatísticos agregados (mediana, variância, quartis) e formatação adequada para decretos de emergência.
US12 a US13 — Licitações e Contratos: cadastro e gestão completos de licitações e contratos; vínculo de estações e sensores aos contratos.

## 3. Estratégia e Níveis de Teste
#### 3.1. Testes de API e Integração (Backend & Ingestão)
Endpoints de Ingestão de Telemetria (POST /api/telemetria):
Casos Positivos: Envio de payload JSON completo da estação com dados de chuva, vento, pressão, etc. Resposta esperada: HTTP 201 Created ou 202 Accepted.
Casos Negativos & Bordas: Envio de parâmetros com valores fora do range físico (ex.: temperatura de 150 °C, pressão negativa, umidade > 100%), envio de MAC inexistente, payload malformado (deve retornar HTTP 400 Bad Request ou 422 Unprocessable Entity).
Contrato de API (OpenAPI): Validação automatizada para garantir que schemas e rotas públicas estejam estritamente alinhados ao padrão e-PING.
#### 3.2. Testes de Integração IoT & Datalogger
Simulação de Datalogger (Hardware/Firmware ESP32):
Simulação de envio com intermitência de rede (mock de falhas de conexão para atestar buffer local de dados e retentativa de reenvio sem duplicidade ou perda).
Validação do carimbo de tempo (timestamp) da medição vs. momento de recepção (ingestion time).
#### 3.3. Testes Funcionais e Regras de Negócio de Alertas
Matriz de Teste para Gatilhos de Risco:
Inserção de valor de precipitação abaixo do limiar → Status normal, nenhum alerta disparado.
Inserção de valor violando limiar configurado (ex.: chuva acumulada > 50 mm/h) → Alerta gerado com severidade correta (Atenção, Alerta ou Emergência) e gravado na trilha de auditoria.
#### 3.4. Testes de Segurança e LGPD
Controle de Acesso Baseado em Perfis (RBAC):
Tentar criar/editar estações ou configurar alertas utilizando token de perfil Público (resultado esperado: HTTP 403 Forbidden).
Tentar acessar endpoints protegidos sem token (resultado esperado: HTTP 401 Unauthorized).
LGPD e Trilha Forense:
Verificar se logs de auditoria registram quem, quando e qual ação foi executada em configurações críticas, sem expor credenciais ou senhas em texto puro.
#### 3.5. Testes Não Funcionais (Performance e Carga)
Recepção Concorrente: Testar a ingestão simultânea simulando múltiplos nós sensores enviando telemetria a cada 1 a 5 minutos, garantindo que o banco de dados mantenha tempo de resposta inferior a 2 segundos.
Consultas aos Dashboards: Simular acessos simultâneos de usuários públicos e operadores aos relatórios sem degradação do pipeline de recepção.

## 4. Integração com CI/CD e Quality Gates
Alinhado ao pipeline automatizado do repositório:
Git Push / PR
Build & Lint
Testes Unitários & Integração
Quality Gate (SonarQube / Linter):
Cobertura de testes unitários ≥ 75%
0 Bugs Críticos / Vulnerabilidades de Segurança (OWASP)
Linting e formatação sem quebras
Build da Imagem Docker (PostgreSQL / App)
Deploy Automatizado em Ambiente de Homologação / Staging
Smoke Test nos Endpoints Principais

## 5. Critérios de Homologação, GO / NO-GO
Antes de qualquer entrega de sprint ou liberação para apresentação ao parceiro (Tecsus), a versão candidata passa pela matriz de decisão:
Critérios Mandatórios para "GO":
Todos os critérios de aceitação das User Stories da Sprint atendidos.
Ingestão de telemetria funcionando sem perda de pacotes em carga padrão.
Geração e exibição de alertas de emergência validadas ponta a ponta.
Trilha de auditoria registrando eventos corretamente.
Nenhum bug de severidade Crítica ou Alta aberto.
Critérios para "NO-GO":
Qualquer falha na recepção de dados que cause perda de série histórica.
Falha de segurança que permita a perfil não autenticado alterar parâmetros ou desativar alertas.
Divergência matemática nos cálculos estatísticos ou falha de exportação de relatórios (PDF/CSV).

## 6. Modelo Padronizado de Registro de Bugs
Para o time registrar ocorrências no backlog/quadro:
ID / Título: [BUG-USxx] Descrição curta e objetiva
Épico / Módulo: Ex.: Épico 5 — Gestão de Alertas
Severidade:
Crítica: Falha no disparo de alerta de emergência ou perda de dados no banco.
Alta: Erro de cálculo em relatório oficial ou rota de API indisponível.
Média: Erro de filtro no dashboard que possui rota alternativa.
Baixa: Ajuste visual ou inconsistência tipográfica na interface.
Ambiente: Docker / Localhost ou Homologação
Pré-condições: Ex.: Estação UUID x cadastrada com sensor pluviômetro ativo.
Passos para Reproduzir:
Enviar payload de telemetria {"chuva_mm": 65}.
Acessar tela de monitoramento com usuário operador.
Resultado Esperado: Alerta de criticidade "Emergência" disparado e visível no painel.
Resultado Obtido: O valor é salvo no banco, mas nenhum alerta foi gerado no painel.
Evidências: Logs do container, print do console ou gravação do erro.
