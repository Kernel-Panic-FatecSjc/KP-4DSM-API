# Padrão e-PING dos dados abertos

Define o formato das rotas públicas `/v1/dados-abertos/*` (US08, SCRUM-48 e SCRUM-49), o dicionário de dados e o checklist de aderência ao e-PING (RNF13, SCRUM-50).

> **Escopo da aderência.** Este documento registra só as diretrizes do e-PING que a equipe selecionou para as rotas públicas de dados (seção 4). Ele **não declara conformidade integral** com o e-PING. As diretrizes foram levantadas pela equipe e precisam ser conferidas por quem revisa contra o texto vigente do e-PING (gov.br), item que está no checklist.

## 1. Padrão dos formatos

| Tema | Decisão |
| --- | --- |
| Versão | Prefixo `/v1` nas rotas (`/v1/dados-abertos/medidas`, `/estacoes`, `/alarmes`). Mudança incompatível cria `/v2`; a `/v1` não muda de campos. |
| Acesso | Público, sem login (`@Publico()`), sob o limite de requisições existente (429 ao exceder). Somente `GET`. |
| Escolha do formato | `?formato=json` (padrão) ou `?formato=csv`; o header `Accept` (`application/json` ou `text/csv`) vale quando `formato` não vem. Outro valor: `400`. |
| Codificação | UTF-8 em JSON e CSV. |
| Datas e horas | ISO 8601 em UTC com sufixo `Z` (ex.: `2026-11-08T14:00:00.000Z`). Nada em horário local. |
| Coordenadas | WGS84 (EPSG:4326), graus decimais, campos `latitude` e `longitude`. |
| Números | Ponto como separador decimal, sem separador de milhar, nos dois formatos. |
| Nomes de campos | `camelCase`, iguais no JSON e no cabeçalho do CSV, e estáveis dentro da versão. |
| Enumerações | Valores em maiúsculas como no sistema (`ATIVA`, `MAIOR_QUE`, `EMERGENCIA`...). |
| JSON | Objeto `{ "dados": [...], "paginacao": { "pagina", "tamanhoPagina", "total" } }`. Sem dados: `dados: []` e `total: 0`, com status 200. |
| CSV | Primeira linha de cabeçalho; separador `;`; aspas duplas em campos com `;`, `"`, vírgula ou quebra de linha, com `"` escapado como `""`; BOM UTF-8 e proteção contra fórmula, como nas exportações atuais (`src/exportacao/csv.ts`). Resposta com `Content-Disposition: attachment`. |
| Paginação | `pagina` (a partir de 1) e `tamanhoPagina` (padrão 100, máximo 1000), iguais em JSON e CSV. |
| Limite de período | Medidas: no máximo 31 dias na agregação horária e 366 dias na diária. Alarmes: no máximo 366 dias. Período acima disso: `400`. |
| Erros | `400` parâmetro inválido ou formato/período não suportado, `429` limite de requisições. Corpo de erro padrão do Nest (`statusCode`, `message`, `error`). |
| Integridade | A rota só lê e agrega o que existe; não cria nem altera dados (RNF13-R2). |

## 2. Dicionário de dados

Os mesmos campos valem no JSON e no CSV. Onde há lista, o CSV usa uma coluna única com os itens separados por ` | `.

### 2.1 `GET /v1/dados-abertos/medidas`

Parâmetros de consulta: `de` e `ate` (datas ISO 8601, obrigatórios), `granularidade` (`hora` ou `dia`, obrigatório), `estacaoId` e `parametro` (opcionais), `formato`, `pagina`, `tamanhoPagina`.

| Campo | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `estacaoId` | texto (UUID) | — | Identificador da estação. |
| `estacaoNome` | texto | — | Nome da estação. |
| `parametro` | texto | — | Nome do tipo de parâmetro medido (ex.: `Temperatura`). |
| `unidade` | texto | variável | Unidade do parâmetro (ex.: `°C`, `mm`). |
| `inicio` | data-hora ISO 8601 UTC | — | Início da hora ou do dia agregado. |
| `granularidade` | texto | — | `hora` ou `dia`. |
| `agregacao` | texto | — | Regra aplicada: `SOMA` (ex.: precipitação) ou `MEDIA`. |
| `valor` | número | a do `unidade` | Valor agregado no intervalo. |
| `quantidadeLeituras` | inteiro | — | Quantidade de leituras que compõem o valor. |

### 2.2 `GET /v1/dados-abertos/estacoes`

Parâmetros: `status` (opcional, `ATIVA` ou `INATIVA`), `formato`, `pagina`, `tamanhoPagina`.

| Campo | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `id` | texto (UUID) | — | Identificador da estação. |
| `nome` | texto | — | Nome da estação. |
| `latitude` | número | graus (WGS84) | Latitude. |
| `longitude` | número | graus (WGS84) | Longitude. |
| `statusOperacional` | texto | — | `ATIVA` ou `INATIVA`. |
| `sensores` | lista de `{ nome, unidade }` | — | Parâmetros que a estação mede. No CSV: `nome (unidade)` separados por ` \| `. |

### 2.3 `GET /v1/dados-abertos/alarmes`

Parâmetros: `de`, `ate` (obrigatórios), `estacaoId`, `severidade`, `status` (opcionais), `formato`, `pagina`, `tamanhoPagina`.

| Campo | Tipo | Unidade | Descrição |
| --- | --- | --- | --- |
| `id` | texto (UUID) | — | Identificador do alarme. |
| `disparadoEm` | data-hora ISO 8601 UTC | — | Momento em que o alarme foi disparado. |
| `estacaoId` | texto (UUID) | — | Estação que originou o alarme. |
| `estacaoNome` | texto | — | Nome da estação. |
| `parametro` | texto | — | Parâmetro monitorado. |
| `operador` | texto | — | Condição do alerta: `MAIOR_QUE`, `MENOR_QUE`, `IGUAL_A`, `DIFERENTE_DE`, `MAIOR_OU_IGUAL`, `MENOR_OU_IGUAL`. |
| `valorLimite` | número | unidade do parâmetro | Limite configurado no alerta. |
| `valorMedido` | número | unidade do parâmetro | Valor que disparou o alarme. |
| `severidade` | texto | — | `ATENCAO`, `ALERTA` ou `EMERGENCIA`. |
| `status` | texto | — | `ABERTO`, `RECONHECIDO` ou `RESOLVIDO`. |

### 2.4 Campos que não são publicados (LGPD e segurança)

Usuário que cadastrou a estação (`usuarioId`) e qualquer dado de usuário, `chaveIngestaoHash`, `vid` do dispositivo, `endereco`, `licitacaoId` e dados de auditoria. Os testes da SCRUM-51 conferem a ausência de campos de usuário.

## 3. Reflexo no Swagger

O dicionário é a fonte dos `@ApiProperty` (descrição, unidade, exemplo) dos DTOs de resposta das três rotas. Se campo, tipo ou unidade mudar aqui, o DTO muda junto na mesma alteração.

## 4. Checklist de aderência ao e-PING

Legenda: **Atendido** (já vale hoje), **A implementar** (definido neste padrão, vira código na SCRUM indicada), **A validar** (precisa de conferência do revisor).

| # | Diretriz selecionada | Como atendemos | Situação |
| --- | --- | --- | --- |
| 1 | Interconexão: acesso por protocolo web padrão (HTTP/HTTPS) com API REST | Rotas `GET` sob `/v1/dados-abertos` | A implementar (SCRUM-48/49) |
| 2 | Interconexão: transporte seguro (TLS) em produção | Cabe ao ambiente de publicação (proxy/hospedagem) | A validar |
| 3 | Organização e intercâmbio de informações: formatos abertos e não proprietários | JSON e CSV | A implementar (SCRUM-48/49) |
| 4 | Organização e intercâmbio: codificação de caracteres UTF-8 | UTF-8 em JSON e CSV | A implementar (SCRUM-48/49) |
| 5 | Organização e intercâmbio: datas no padrão ISO 8601 | Datas em UTC com `Z` | A implementar (SCRUM-48/49) |
| 6 | Organização e intercâmbio: referência geográfica em sistema geodésico padrão | WGS84 (EPSG:4326) | A implementar (SCRUM-49) |
| 7 | Organização e intercâmbio: dados descritos e documentados (metadados) | Dicionário de dados (seção 2) e OpenAPI 3.0 em `/docs` e `/docs-json` | Dicionário feito; OpenAPI parcial (SCRUM-45 feita, SCRUM-46 pendente) |
| 8 | Organização e intercâmbio: contrato estável e versionado | Prefixo `/v1`, campos estáveis na versão | A implementar (SCRUM-48/49) |
| 9 | Segurança: proteção contra abuso das rotas públicas | Limite de requisições existente (429) | Atendido |
| 10 | Segurança e privacidade: não expor dados pessoais (LGPD) | Seção 2.4; testes na SCRUM-51 | A implementar (SCRUM-49/51) |
| 11 | Verificação: contrato OpenAPI válido a cada alteração | Geração e lint no CI | A implementar (SCRUM-47) |

### Pendências de revisão

- [ ] Conferir cada diretriz acima contra o texto vigente do e-PING e ajustar a lista (incluir/remover itens) para o escopo final.
- [ ] Revisão do padrão da seção 1 e do dicionário da seção 2 por outro membro do time.
- [ ] Definir o escopo do que é público (todas as licitações ou só as autorizadas): o modelo hoje não tem marcação de publicidade.

Revisor: ______________________  Data: ____/____/______
