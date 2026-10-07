# Rastreabilidade de Requisitos

Este documento descreve como a equipe **Kernel Panic** garante a rastreabilidade no desenvolvimento do **DATA PANIC**, desde a definição dos requisitos até as branches, commits e pull requests.

Cada requisito é um ticket do tipo **Requisito** no Jira. User Stories e Tasks são ligadas aos Requisitos que atendem pelo link padrão do Jira **é relacionado com**, e as Tasks são filhas das User Stories. User Story e Task não existem sem um Requisito.

* Uma User Story implementa de 1 a N Requisitos.
* Uma Task implementa de 1 a N Requisitos, escolhidos entre os Requisitos da sua User Story.
* O ideal é que uma Task implemente no máximo um Requisito funcional.

```
          Épico
            ↓
Requisito ←(é relacionado com)— User Story
    ↑                       ↓ (pai)
    └──(é relacionado com)── Task (SCRUM-{ID}) → Branch → Commits → Pull Request
```

---

## Configuração do Jira

| Item | Configuração |
| --- | --- |
| Tipo de issue | `Requisito`, com etiqueta `funcional`, `nao-funcional` ou `tecnico` |
| Tipo de link | `é relacionado com` (padrão do Jira, sem configuração) |
| Hierarquia | Épico > User Story > Task (padrão do Jira) |
| Projeto | Company-managed (necessário para criar tipos de issue) |

## 1. Definição dos Requisitos

**Objetivo:** Especificar o que o sistema precisa ter e registrar cada requisito como um ticket no Jira.

**Responsáveis:** Product Owner, Dev Team.

**Insumos:**
* Reuniões com o cliente e com a equipe.
* Documentação base fornecida pelo cliente.
* Proposta de solução aprovada pelo cliente.

**Entregáveis:**
* Tickets do tipo Requisito no Jira, com etiqueta `funcional`, `nao-funcional` ou `tecnico`.

**Regras:**
* Cada requisito é um ticket próprio, com descrição objetiva e origem (reunião, documento do cliente etc.).
* Requisito técnico (`tecnico`) é uma necessidade da equipe sem valor direto ao cliente, como configurar o banco ou a pipeline. Ele segue as mesmas regras dos demais.
* O requisito é validado com o cliente antes de receber User Stories.

## 2. Backlog do Produto

**Objetivo:** Extrair User Stories dos Requisitos e organizá-las no Product Backlog.

**Responsáveis:** Product Owner.

**Insumos:**
* Requisitos validados com o cliente.

**Entregáveis:**
* User Stories no Jira, ligadas aos Requisitos que atendem e agrupadas em Épicos.

**Regras:**
* Toda User Story tem pelo menos um link `é relacionado com` para um Requisito. Uma User Story pode atender mais de um Requisito.
* Todo Requisito tem pelo menos uma User Story que o implementa.
* User Stories seguem o formato "Como [ator], quero [funcionalidade] para [finalidade]" e têm critérios de aceitação.
* User Stories seguem a [Definition of Ready](dor.md) antes de entrar na sprint.

## 3. Sprint Backlog

**Objetivo:** Selecionar User Stories para a sprint e quebrá-las em Tasks.

**Responsáveis:** Product Owner, Dev Team.

**Insumos:**
* Product Backlog priorizado.

**Entregáveis:**
* Sprint Backlog com a meta da sprint.
* Tasks no Jira, cada uma filha de uma User Story e identificada por `SCRUM-{ID}`.

**Regras:**
* Toda Task é criada como filha de uma User Story. Task sem User Story pai não entra na sprint.
* Toda Task tem pelo menos um link `é relacionado com` para um Requisito, e todos os Requisitos da Task precisam estar ligados à User Story pai.
* O ideal é que uma Task implemente no máximo um Requisito funcional. Task com mais de um deve ser quebrada, a não ser que a equipe justifique na planning.
* Tasks não técnicas (documentação, pesquisa, alinhamento) seguem a mesma regra: são ligadas a um Requisito `tecnico` (ex: "Documentação do processo") ou aos Requisitos da User Story que as motivou.
* Todo bug é registrado no Jira e ligado, por `é relacionado com`, ao Requisito que deixou de ser atendido.
* Uma User Story só é concluída quando todas as suas Tasks estiverem concluídas.
* Um Requisito só é concluído quando todas as User Stories que o implementam estiverem concluídas.
* O esforço das User Stories é estimado (story points).

## 4. Branch, Commit e Pull Request

**Objetivo:** Ligar o código à Task e, por ela, à User Story e ao Requisito.

**Responsáveis:** Dev Team.

**Insumos:**
* Task do Jira com ID `SCRUM-{ID}`.

**Entregáveis:**
* Branches, commits e Pull Requests identificados com o ID da Task.

**Regras:**
* Branch: `tipo/SCRUM-{ID}-descricao-curta` (ver [estratégia de branches](estrategiabranch.md)).
* Commit: `tipo(SCRUM-{ID}): descrição` (ver [padrão de commit](padraocommit.md)).
* Título do PR: mesmo formato do commit.
* A branch é aberta a partir da Task no Jira, para que branches, commits e PRs apareçam no card.

---

## Garantia da regra

O Jira não obriga o link entre User Story/Task e Requisito, então a regra é cobrada em dois pontos:

1. **Automação do Jira** (avisa na hora):
   * **Gatilho:** issue criada.
   * **Condição:** tipo de issue = História, Tarefa ou Bug **e** nenhuma issue vinculada pelo link `é relacionado com` é do tipo Requisito.
   * **Ação:** adiciona a etiqueta `sem-requisito` e comenta na issue pedindo o vínculo.
2. **Planning** (barra a entrada na sprint): a DoR exige o vínculo, e o filtro de itens sem Requisito deve voltar vazio antes da sprint começar. Na mesma revisão, a equipe confere se os Requisitos de cada Task estão entre os da sua User Story e se alguma Task tem mais de um Requisito funcional, já que o Jira não valida isso sozinho.

## Consultas (JQL)

| Pergunta | Filtro |
| --- | --- |
| User Stories, Tasks e bugs sem Requisito | `project = SCRUM AND labels = sem-requisito` |
| User Stories que implementam o SCRUM-5 | `issue in linkedIssues("SCRUM-5", "é relacionado com") AND issuetype = Story` |
| Tasks que implementam o SCRUM-5 | `issue in linkedIssues("SCRUM-5", "é relacionado com") AND issuetype = Task` |
| Bugs abertos do SCRUM-5 | `issue in linkedIssues("SCRUM-5", "é relacionado com") AND issuetype = Bug AND statusCategory != Done` |
| O que falta do SCRUM-5 | `issue in linkedIssues("SCRUM-5", "é relacionado com") AND issuetype in (Story, Task) AND statusCategory != Done` |
| Qual código implementa a SCRUM-12? | Card da Task no Jira (integração com o GitHub) ou `git log --grep="SCRUM-12"` |
