# Regras da licitação (modelo por licitação)

Substitui a [decisão de modelagem anterior](decisao-modelagem-licitacao.md), em que licitação, contrato e órgão eram tabelas separadas. Agora **a licitação é o centro do modelo**: o contrato que saiu dela e o órgão contratante viram campos da própria licitação, e toda entidade de negócio pertence a uma licitação. É por ela que o acesso é filtrado (multi-inquilino).

Este documento é a base para revisar a **US12** com o PO (ver [Proposta de texto da US12](#proposta-de-texto-da-us12)). As respostas já dadas pela equipe no guia da sprint estão incorporadas.

## Modelo

| Tabela | Como fica |
| --- | --- |
| `licitacoes` | `codigoIdentificador` (único, ex.: `PMSJC-2026`), processo (`numeroProcesso`, `modalidade`, `objeto`), contrato (`numeroContrato`, `inicioVigencia`, `fimVigencia`, `status`, `encerradaEm`) e órgão (`orgaoNome`, `orgaoCnpj`, `orgaoEsfera`, `orgaoMunicipio`, `orgaoUf`) |
| `contratos`, `orgaos_publicos` | Removidas: uma licitação tem **um** contrato e **um** órgão |
| `usuarios` | `licitacaoId` (nulo = Tecsus) e `tipo` ∈ `ADMIN_TECSUS`, `ADMIN_LICITACAO`, `USUARIO_LICITACAO`. Check no banco: só `ADMIN_TECSUS` não tem licitação |
| `estacoes` | `licitacaoId` obrigatório: **não existe estação sem licitação** |
| `tipos_parametro`, `alertas` | `licitacaoId`. **Não há tipos globais da Tecsus**: cada licitação tem os seus, com nome único dentro dela |
| `medidas`, `leituras_erro` | `licitacaoId` gravado pelo serviço de tratamento a partir da estação. O histórico não muda de dono se a estação mudar de licitação |
| `logs_auditoria` | `licitacaoId` de quem fez a ação (nulo = Tecsus ou visitante) |
| `parametros`, `alarmes`, `leituras_brutas` | Herdam pela estação, pelo alerta ou pelo `vid` |

**Consistência** (trigger adiado para o commit, além da checagem no serviço): parâmetro, tipo de parâmetro e alerta ativo são da mesma licitação da estação.

A migration `20261024120000_modelo_por_licitacao` leva o que já existir para uma licitação `LEGADO` (estações, tipos, alertas, medidas e leituras com erro), converte `ADMINISTRADOR` em `ADMIN_TECSUS` e `MONITOR` em `USUARIO_LICITACAO` da `LEGADO`, e descarta contratos e órgãos (eram dados de teste).

## Perfis

| Perfil | Escopo | Pode |
| --- | --- | --- |
| `ADMIN_TECSUS` | Todas as licitações | Tudo: licitações (cadastro, edição, encerramento, vínculo de estações), usuários de qualquer perfil, estações, sensores, alertas, auditoria de todos |
| `ADMIN_LICITACAO` | A própria licitação | Cadastrar e gerenciar `USUARIO_LICITACAO` da licitação; estações, sensores e alertas da licitação; ler a auditoria da licitação |
| `USUARIO_LICITACAO` | A própria licitação | Ler os dados da licitação e mudar o status de alarmes. **Sem permissão de cadastro** |
| Visitante (sem login) | Região (100 km) | Página pública de alertas (`/alertas-globais`), que continua aberta e só de leitura |

- O filtro de licitação fica **no backend**, em todo serviço de leitura (estações, tipos de parâmetro, alertas, alarmes, dashboard, leituras brutas pelo `vid`, leituras com erro, auditoria). O usuário de licitação nunca escolhe outra: pedir `licitacaoId` de outra licitação devolve **403**, e consultar um registro de outra licitação por id também. A Tecsus pode filtrar por `licitacaoId` (opcional).
- Perfil, licitação e status vêm do banco a cada requisição (não só do token): mudar o perfil de alguém ou encerrar a licitação vale na hora.
- Cada um edita os próprios dados (nome, e-mail, senha). Só a Tecsus muda perfil ou licitação de um usuário. Um usuário pertence a **uma** licitação.

## Ciclo de vida da licitação

```
RASCUNHO ──► VIGENTE ◄──► SUSPENSA
    │           │            │
    └───────────┴────────────┴──► ENCERRADA (final)
```

- As transições são as mesmas que valiam para o contrato. Toda licitação nasce `RASCUNHO` (ou já `VIGENTE`), nunca `ENCERRADA`.
- Só fica `VIGENTE` com a vigência ainda não vencida; fim da vigência ≥ início.
- `codigoIdentificador`, `numeroProcesso` e `numeroContrato` são únicos (409 se repetir).
- **Escrita pelos usuários da licitação só com ela `VIGENTE`.** Em `RASCUNHO`, `SUSPENSA` ou `ENCERRADA` eles entram e leem, mas toda escrita devolve 403 ("acesso somente leitura"). A Tecsus continua escrevendo.

### Quando pode encerrar e o que acontece

- Só a Tecsus encerra (`PATCH /licitacoes/:id/encerrar`), a partir de qualquer status que não seja `ENCERRADA`. Encerrar não é feito pelo `PATCH` comum, porque tem efeitos.
- Na mesma transação:
  - a licitação fica `ENCERRADA`, com `encerradaEm` gravado, e passa a ser imutável;
  - **as estações continuam dela, só para leitura**: ficam `INATIVA`. Se ainda publicarem, o pacote é guardado em `leituras_brutas`, mas não vira medida nem dispara alarme;
  - **os alertas** ficam inativos (não disparam mais); os alarmes e as medidas continuam como histórico;
  - **os usuários** continuam ativos, entram e só leem.
- Licitação encerrada não recebe estações, sensores nem usuários novos.

### Vincular estações (transferência)

Como toda estação tem licitação, vincular uma estação a outra licitação é **transferi-la** (`POST /licitacoes/:id/estacoes`, só Tecsus, destino não encerrado):

- os sensores da estação passam a usar os tipos de parâmetro **de mesmo nome** da licitação de destino, que precisam existir lá (senão 400 listando os que faltam);
- os alertas ativos da origem são inativados e ficam como histórico da origem;
- as medidas já gravadas continuam com a licitação de origem.

## Itens que deixam de existir

Com órgão e contrato dentro da licitação, somem "inativar órgão com contrato vigente" e "deletar órgão": não há mais órgão como cadastro próprio. O critério de aceite "inativar órgão com contrato vigente devolve 400" do guia da sprint fica sem objeto.

## Identificador da licitação no broker

O guia perguntava se o `_{CodigoIdentificadorDaLicitação}` vai no nome de usuário, no tópico do broker ou nos dois. **Decisão: em nenhum dos dois.** O tópico é `estacoes/{vid}/telemetria` e o usuário no broker é o `vid` (ver [formato do tópico e do payload](mqtt-topico-payload.md)). Motivos:

- o `vid` já é único no sistema e é a identidade que o datalogger tem; o dono do dado é decidido pelo tratamento a partir da estação;
- pôr a licitação no tópico ou no usuário criaria uma segunda fonte da verdade: transferir a estação de licitação exigiria regravar o firmware, e um datalogger antigo publicaria "na licitação errada";
- o isolamento entre licitações já é garantido pela ACL por estação (cada uma só publica no próprio tópico) e pelo filtro no backend.

O `codigoIdentificador` serve para pessoas: aparece nas telas, filtros, menus e relatórios.

## Proposta de texto da US12

> **US12 — Cadastro e gestão de licitações.** Como **administrador da Tecsus**, quero cadastrar cada licitação ganha com os dados do contrato e do órgão contratante, encerrá-la ao fim do contrato e vincular a ela as estações, para que cada cliente veja e opere só o que é seu.
>
> **Critérios de aceite** (Dado / Quando / Então):
> 1. Dado um admin Tecsus, quando cadastra uma licitação com código, processo, modalidade, objeto, número do contrato, vigência e dados do órgão, então ela é criada como RASCUNHO (ou VIGENTE) e a ação é auditada.
> 2. Dado um código, processo ou contrato já cadastrado, quando tenta cadastrar outra licitação com ele, então recebe 409.
> 3. Dada uma vigência com fim antes do início, ou vencida ao ativar, então recebe 400.
> 4. Dada uma licitação, quando a Tecsus muda o status, então só as transições RASCUNHO→VIGENTE, VIGENTE↔SUSPENSA são aceitas, e encerrar tem ação própria.
> 5. Dada uma licitação vigente com estações e alertas, quando a Tecsus a encerra, então as estações ficam inativas, os alertas param, os usuários dela passam a só ler e a licitação não aceita mais alterações.
> 6. Dado um usuário da licitação A, quando consulta qualquer dado da licitação B, então recebe 403 ou lista vazia.
> 7. Dada uma estação com sensores, quando a Tecsus a vincula a outra licitação que tem os mesmos tipos de sensor, então a estação muda de licitação, os alertas antigos são inativados e o histórico continua com a licitação anterior.
> 8. A listagem tem filtros por status e esfera, busca por código, processo, contrato, objeto, órgão ou município, e paginação.
>
> **Requisitos:** RF10, RF02, RNF14.
