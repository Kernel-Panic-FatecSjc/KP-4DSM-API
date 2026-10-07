# Gestão do Processo - **DATA PANIC**

Este documento descreve o fluxo de trabalho adotado pela equipe **Equipe Kernel Panic** para o desenvolvimento do **DATA PANIC**. Nosso processo visa garantir qualidade, previsibilidade e transparência, desde a chegada de uma demanda até a entrega do valor em produção e o aprendizado gerado depois dela.

---

### Políticas do Time

Antes do fluxo em si, o time mantém um conjunto de políticas que orientam as decisões ao longo de todas as etapas. Elas são definidas uma vez e **revisadas na Retrospectiva**.

* **Definition of Ready (DoR):** critérios para um item de backlog estar claro e pronto para entrar em uma sprint. Aplicada na etapa de Produto e Backlog.
* **Definition of Done (DoD):** critérios para considerar uma entrega concluída. Aplicada antes do merge na main.
* **Pipeline de CI:** configurada para executar build, lint, testes unitários e testes de integração a cada Pull Request.
* **Estratégia de branches:** define como as branches das tarefas nascem e voltam para a main.
* **[Rastreabilidade](rastreabilidade.md):** todo trabalho nasce de um Requisito. User Stories, Tasks e bugs são ligados aos Requisitos no Jira.

---

### Nosso Fluxo de Trabalho em 7 Etapas

O nosso processo pode ser dividido em sete grandes etapas, que se repetem a cada ciclo (sprint):

### 1. Descoberta e Requisitos

Tudo começa com uma demanda bruta, que é analisada antes de virar trabalho.

* **Entrada:** a demanda chega de forma bruta (de clientes, stakeholders ou do próprio time).
* **Análise de Requisitos:** são levantados o problema, os stakeholders envolvidos e as regras de negócio. Cada requisito levantado é registrado como um ticket **Requisito** no Jira, com etiqueta `funcional`, `nao-funcional` ou `tecnico`.
* **Refino da Proposta:** a proposta é detalhada com escopo, valor esperado e riscos.
* **Avaliação do Dev Team:** a proposta é avaliada pelo time em uma reunião, com três desfechos possíveis:
    * **Aprovada:** os Requisitos são validados e seguem para a etapa de Produto e Backlog.
    * **Precisa de ajustes:** os Requisitos voltam para a Análise de Requisitos.
    * **Reprovada:** a demanda e seus Requisitos são arquivados e o solicitante recebe um retorno.

### 2. Produto e Backlog

Com a proposta aprovada, ela é transformada em itens de trabalho priorizados.

* **MVP e Objetivos:** definição ou atualização do **MVP (Minimum Viable Product)** e dos objetivos do produto.
* **Quebra em Itens de Backlog:** a proposta é decomposta em histórias com seus **critérios de aceitação**. Cada User Story é ligada de 1 a N Requisitos.
* **Priorização:** o Product Backlog é priorizado, garantindo que o time trabalhe sempre no que gera mais impacto.
* **Verificação do DoR:** cada item é checado contra a **Definition of Ready**. Se faltar informação, o item volta para a quebra em histórias; se estiver pronto, pode entrar na sprint.

### 3. Planejamento da Sprint

Com itens prontos e priorizados, a equipe realiza a **Sprint Planning**.

* **Planning:** define-se a **meta da sprint** considerando a capacidade do time. Duração da sprint: 3 Semanas.
* **Definição de decisões técnicas e Estimativa:** os itens recebem refinamento técnico e uma estimativa de esforço.
* **Sprint Backlog:** os itens selecionados formam o backlog da sprint.
* **Criação de Tarefas:** os itens são desdobrados em tarefas, classificadas em dois tipos:
    * **Técnicas:** envolvem código e seguem o fluxo de desenvolvimento.
    * **Não técnicas:** documentação, alinhamentos, pesquisa e similares.

  Toda tarefa é filha de uma User Story e ligada de 1 a N Requisitos da própria User Story, idealmente no máximo um funcional. Tarefas não técnicas seguem a mesma regra: são ligadas a um Requisito `tecnico` (ex: "Documentação do processo") ou aos Requisitos da User Story que as motivou.
* **Verificação da Rastreabilidade:** antes de a sprint começar, nenhum item da sprint pode estar sem Requisito (filtro `sem-requisito` vazio).

### 4. Execução

O fluxo muda conforme o tipo da tarefa.

**Tarefas técnicas**

* **Branch:** a branch da tarefa é criada a partir da `main` seguindo a [estratégia de branches](estrategiabranch.md), com o ID da tarefa (`SCRUM-{ID}`) na branch, nos commits e no PR.
* **Implementação e Testes Unitários:** o desenvolvedor implementa a tarefa com commits frequentes na branch, escrevendo testes unitários.
* **Pull Request:** ao concluir a tarefa, abre-se um PR da branch da tarefa para a `main`.
* **Integração Contínua (CI):** a abertura do PR dispara a pipeline. Se falhar, a tarefa volta para a implementação.
* **Code Review:** com a CI verde, o código é revisado por outro desenvolvedor com base nos critérios de aceitação e na política de testes. Se reprovado, volta para a implementação.

**Tarefas não técnicas**

* **Execução:** a tarefa é realizada pelo responsável. Entregáveis versionados no repositório (documentação, diagramas, atas) podem ser commitados direto na `main` (ver [exceção na estratégia de branches](estrategiabranch.md#exceção-documentação-e-entregáveis-não-técnicos)).
* **Validação:** outro desenvolvedor valida o resultado. Se não estiver adequado, a tarefa é refeita; se estiver, é considerada concluída.

### 5. Validação e Integração

Após a aprovação no Code Review, as tarefas técnicas passam por validações adicionais antes de entrar na base principal.

* **Deploy em Staging:** a branch da tarefa é publicada no ambiente de homologação.
* **Testes de Sistema e Aceite do PO:** o sistema é testado de forma integrada e o **Product Owner** dá o aceite. Se reprovado, a tarefa volta para a implementação.
* **Verificação do DoD:** a entrega é checada contra a **Definition of Done**. Se não atender, volta para a implementação.
* **Merge na main:** atendidos todos os critérios, a branch é integrada na `main` e a feature branch excluida.
* **Tarefa Concluída:** estado final tanto das tarefas técnicas (após o merge) quanto das não técnicas (após a validação). A User Story é concluída quando todas as suas tarefas estão concluídas, e o Requisito quando todas as suas User Stories estão concluídas.

### 6. Release e Operação

Ao final da sprint, o que foi concluído é entregue aos usuários.

* **Geração da Release:** criada a partir da `main`, com **tag de versão** e **changelog**.
* **Regressão e Smoke Test:** o release candidate é testado. Se falhar, o problema retorna ao fluxo de desenvolvimento.
* **Deploy em Produção:** realizado após a aprovação do release candidate.
* **Health Check:** verifica a saúde do sistema após o deploy.
    * **Se OK:** o sistema é considerado entregue em produção.
    * **Se falhar:** é feito **rollback** para a versão anterior, seguido de **análise de causa e hotfix**, que retorna ao fluxo de desenvolvimento.

### 7. Feedback e Melhoria Contínua

Com a entrega feita, o ciclo se fecha e alimenta o próximo.

* **Sprint Review:** demonstração do que foi entregue aos stakeholders. Novos requisitos e ajustes levantados voltam para a etapa de Descoberta.
* **Bugs e Métricas de Uso:** problemas e dados coletados em produção alimentam diretamente a priorização do Product Backlog. Todo bug é registrado no Jira e ligado ao Requisito que deixou de ser atendido.
* **Retrospectiva:** o time reflete sobre o ciclo, revisa as **Políticas do Time** e segue para a próxima Sprint Planning.
