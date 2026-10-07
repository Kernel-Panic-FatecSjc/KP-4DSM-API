# Estratégia de Branches

Adotamos o **GitHub Flow**, com validação da branch em staging antes do merge e releases versionadas ao final de cada sprint.
Esta estratégia combina a simplicidade de uma única branch principal com um processo de lançamento controlado para o ambiente de produção. O modelo se alinha aos requisitos de Integração Contínua (CI) e às políticas do time, como a Definition of Ready (DoR) e a Definition of Done (DoD).

A filosofia é simples: a branch `main` representa o código mais atual e já validado, enquanto o ambiente de produção é atualizado apenas por meio de releases explícitas, geradas ao final de cada sprint.

### Fluxo de Trabalho

1. **Branch principal**

   - Utilizamos apenas uma branch de longa duração: `main`.
   - Ela só recebe código que passou por CI, code review, testes de sistema, aceite do PO e DoD.

2. **Branches de tarefa**

   - Cada tarefa técnica é desenvolvida em uma branch curta, criada a partir da `main`.
   - Os commits são frequentes, representam o escopo de uma tarefa, e a implementação inclui testes unitários.
   - Nomenclatura: `tipo/SCRUM-{ID}-descricao-curta`, onde `tipo` segue o [padrão de commit](padraocommit.md) e `SCRUM-{ID}` é o ID da tarefa no Jira.
        - `feat/SCRUM-12-tela-de-login`
        - `fix/SCRUM-34-validacao-de-email`

3. **Pull Requests (PRs)**

   - Ao concluir a implementação, abre-se um **PR** da branch da tarefa para a `main`.
   - A abertura do PR dispara a pipeline de CI (build, lint, testes unitários e de integração). Se a CI falhar, a tarefa volta para a implementação.
   - Com a CI aprovada, o código passa por **code review**, que verifica os critérios de aceitação e a política de testes. Se for reprovado, volta para a implementação.
   - Padrão de título e número mínimo de revisores: 
        - O título do PR segue o mesmo formato do commit: `tipo(SCRUM-{ID}): descrição` (ex: `feat(SCRUM-12): Criação da tela de login`)
        - Devem contar com um revisor que não é o responsável direto pela task.

4. **Validação em Staging**

   - Após a aprovação no code review, e antes do merge na main, a **branch da tarefa** é publicada no ambiente de **staging**.
   - Nesse ambiente são executados os testes de sistema e o **aceite do Product Owner**.
   - Se houver reprovação, a tarefa volta para a implementação com um feedback.

5. **Merge na main**

   - Com a validação em staging aprovada, verifica-se se a entrega atende à **Definition of Done (DoD)**.
   - Se atender, a branch é integrada na `main`. Se não, volta para a implementação.

6. **Publicação em Produção**

   - Ao final da sprint, uma **release** é gerada a partir da `main`, com **tag de versão** e **changelog**.
   - O release candidate passa por testes de regressão e smoke test. Se falhar, o problema retorna ao fluxo de desenvolvimento.
   - Aprovado o release candidate, é feito o deploy em produção, seguido de um **health check**.

7. **Rollback e Hotfixes**

   - Se o health check falhar, é feito **rollback** para a versão anterior.
   - Em seguida, realiza-se a análise de causa e a correção (**hotfix**). O bug é registrado no Jira, ligado ao Requisito afetado, e a correção segue o mesmo fluxo das demais tarefas: nova branch a partir da `main`, PR, CI, code review, validação em staging e nova release.

### Exceção: documentação e entregáveis não técnicos

Atualizações de documentação e entregáveis que não são código (atas, diagramas, relatórios de sprint, arquivos `.md`) podem ser commitadas direto na `main`, sem branch e sem PR.

- O commit só pode conter documentação. Se incluir qualquer arquivo de código ou de configuração da aplicação, segue o fluxo normal.
- O commit segue o [padrão de commit](padraocommit.md) com o tipo `docs`: `docs(SCRUM-{ID}): descrição`. A tarefa continua ligada a um Requisito (ver [rastreabilidade](rastreabilidade.md)).
- A validação por outro membro do time, prevista para tarefas não técnicas, é feita sobre o commit na `main`. Se houver ajuste, ele é feito em um novo commit.
- A branch protection da `main` deve permitir push direto aos membros do time. Se não permitir, abre-se um PR sem exigência de aprovação.

