# Estratégia de Branches

Adotamos o **GitHub Flow**, com staging opcional para testar o código durante a revisão e releases versionadas ao final de cada sprint.
Esta estratégia combina a simplicidade de uma única branch principal com um processo de lançamento controlado para o ambiente de produção. O modelo se alinha aos requisitos de Integração Contínua (CI) e às políticas do time, como a Definition of Ready (DoR) e a Definition of Done (DoD).

A filosofia é simples: a branch `main` representa o código mais atual e já validado, enquanto o ambiente de produção é atualizado apenas por meio de releases explícitas, geradas ao final de cada sprint.

### Fluxo de Trabalho

1. **Branch principal**

   - Utilizamos apenas uma branch de longa duração: `main`.
   - Ela só recebe código que passou por CI, code review e DoD.

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

4. **Staging (opcional, durante a revisão)**

   - Para testar o código rodando, o **revisor** coloca o label `staging` no PR. O PR é publicado na branch `staging`, integrado com a `main` atual, e cada push novo no PR republica enquanto o label estiver.
   - Staging é um ambiente só: o label fica em **um PR por vez** (ao rotular um PR, ele sai dos outros). O autor não leva o próprio PR: o label posto por ele é removido.
   - Não há deploy: a pipeline só atualiza a branch `staging`. Os testes de sistema são feitos por quem revisa, rodando essa branch.
   - Se o código não passar, o revisor pede mudanças no review e a tarefa volta para a implementação.

5. **Merge na main**

   - Com a aprovação do review e os checks verdes, verifica-se se a entrega atende à **Definition of Done (DoD)**.
   - Se atender, o PR é mesclado na `main`. Se não, volta para a implementação.
   - Com o merge, a tarefa da branch (`SCRUM-{ID}`) é movida para **Concluído** no Jira automaticamente. PR `revert` não conclui tarefa.

6. **Publicação em Produção**

   - Ao final da sprint, uma **release** é gerada a partir da `main`, com **tag de versão** e **changelog**.
   - O release candidate passa por testes de regressão e smoke test. Se falhar, o problema retorna ao fluxo de desenvolvimento.
   - Aprovado o release candidate, é feito o deploy em produção, seguido de um **health check**.

7. **Rollback e Hotfixes**

   - Se o health check falhar, é feito **rollback** para a versão anterior.
   - Em seguida, realiza-se a análise de causa e a correção (**hotfix**). O bug é registrado no Jira, ligado ao Requisito afetado, e a correção segue o mesmo fluxo das demais tarefas: nova branch `hotfix/SCRUM-{ID}-descricao-curta` a partir da `main`, PR, CI, code review (staging opcional) e nova release.

### Documentação, hotfix e revert

Tudo entra na `main` por PR, sem exceção: não existe push direto, nem de documentação, e ninguém contorna as regras da `main`.

- **`docs`:** PR com o tipo `docs(SCRUM-{ID}): descrição`. Se ele só mudar arquivos de documentação (`docs/` e `*.md`), **não precisa de review**: o status `revisao/aprovada` passa sozinho. Se mexer em qualquer outro arquivo, o status falha e o PR segue o fluxo normal, com o tipo certo.
- **`hotfix`:** correção urgente. Passa por PR, CI e os checks de padrão, e **exige review**. O staging é opcional.
- **`revert`:** reversão de uma mudança já mesclada. Não use o botão Revert do GitHub (ele gera nomes fora do padrão): crie a branch `revert/SCRUM-{ID}-descricao-curta` e commite `revert(SCRUM-{ID}): descrição`. Exige review.
- Tarefas de documentação e entregáveis não técnicos continuam ligadas a um Requisito (ver [rastreabilidade](rastreabilidade.md)).

### Como a pipeline garante esta estratégia

| Regra | Onde é verificada | Check no PR |
| --- | --- | --- |
| PR de tarefa vai para a `main` | `.github/workflows/estrategia-branch.yaml` | Estratégia de branch |
| Branch `tipo/SCRUM-{ID}-descricao-curta` | `.github/workflows/estrategia-branch.yaml` | Estratégia de branch |
| Título e commits `tipo(SCRUM-{ID}): descrição`, mesmo ID na branch e no título | `.github/workflows/estrategia-branch.yaml` e hook `commit-msg` | Estratégia de branch |
| Tarefa da branch e dos commits ligada a Requisito no Jira, dentro dos Requisitos do pai (ver [rastreabilidade](rastreabilidade.md)) | `.github/workflows/rastreabilidade-requisito.yaml` | Requisito vinculado |
| CI verde (build, lint, testes, migrations) | `.github/workflows/ci.yaml` | CI ok |
| Aprovação de quem não é o autor, no commit atual (`docs` só de documentação dispensa) | `.github/workflows/revisao-exigida.yaml` | `revisao/aprovada` (status do commit) |
| Staging opcional, por label do revisor | `.github/workflows/publicar-staging.yaml` | nenhum (não bloqueia o merge) |
| Sem push direto e sem push forçado na `main` | Rulesets da `main` | nenhum |
| Tarefa da branch vai para Concluído no Jira quando o PR é mesclado (menos `revert`) | `.github/workflows/concluir-tarefa.yaml` | nenhum (roda depois do merge) |

**Staging por label.** O revisor coloca o label `staging` no PR; o workflow tira o label dos outros PRs abertos e publica na branch `staging` o PR integrado com a `main` atual. O label posto pelo autor é removido com um aviso. Enquanto o label estiver, cada push novo no PR republica. Não há aceite nem status: staging serve só para testar durante a revisão.

**Configuração no GitHub.**

* Ruleset `main - histórico`, sem bypass: bloquear *force push* e exclusão.
* Ruleset `main - merge`, sem bypass: exigir PR, e exigir os checks `CI ok`, `Estratégia de branch`, `Requisito vinculado` e o status `revisao/aprovada`. A contagem de aprovações não fica na ruleset porque ela não tem exceção por tipo de PR; é o status `revisao/aprovada` que cobra a aprovação e já descarta a que ficou para um commit antigo.
* Label `staging` no repositório.
* Secrets do repositório `JIRA_BASE_URL`, `JIRA_EMAIL` e `JIRA_API_TOKEN`, usados pelo check `Requisito vinculado` e pelo workflow que conclui a tarefa no merge. O usuário do token precisa ler as issues e poder transicioná-las no projeto. PR de fork não recebe secrets, e o check falha nele.
* Branch `staging` sem ruleset: ela é sobrescrita pelo workflow a cada publicação.
