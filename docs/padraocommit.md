# Padrão de commit

Formato: `tipo(SCRUM-{ID}): descrição`, onde `SCRUM-{ID}` é o ID da tarefa no Jira. O mesmo ID aparece no nome da branch e no título do PR (ver [estratégia de branches](estrategiabranch.md)), ligando o código à tarefa.

| Tipo         | Descrição                                                                     | Exemplo                                                                                            |
| ------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **feat**     | Quando da adição de um recurso, uma *feature* (funcionalidade).               | `feat(SCRUM-{ID}): Implementação dos repositories usados nas operações com as tabelas de variações climáticas` |
| **fix**      | Correção de um bug.                                                           | `fix(SCRUM-{ID}): Correção do componente de seleção de município`                                              |
| **docs**     | Atualização de documentação.                                                  | `docs(SCRUM-{ID}): Inclusão de diagrama de modelo de BD para a aplicação`                                      |
| **style**    | Mudança de formatação, sem afetar o código.                                   | `style(SCRUM-{ID}): Ajuste de nomes de variáveis para o padrão camelCase`                                      |
| **refactor** | Refatoração do código, sem alterar funcionalidade.                            | `refactor(SCRUM-{ID}): Ajuste na estrutura do código para melhor legibilidade`                                 |
| **test**     | Adiciona ou modifica testes.                                                  | `test(SCRUM-{ID}): Criação de testes unitários para o módulo de autenticação`                                  |
| **chore**    | Atualizações menores que não impactam diretamente a funcionalidade do código. | `chore(SCRUM-{ID}): Atualização de dependências do projeto`                                                    |
| **ci**       | Alterações nos pipelines de Integração Contínua e Deploy Automático.          | `ci(SCRUM-{ID}): Ajuste no workflow de deploy para rodar migrations antes de iniciar a aplicação`              |