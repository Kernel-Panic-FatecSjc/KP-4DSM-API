// Valida a mensagem no hook commit-msg com a mesma regra da CI
// (.github/workflows/padrao-commit-pr.yaml). Se mudar o padrão lá, mude aqui.
const PADRAO = /^(feat|fix|docs|style|refactor|test|chore|ci)\(SCRUM-[0-9]+\): .+/;

const AJUDA = `mensagem fora do padrão.

  Formato esperado:  tipo(SCRUM-{ID}): descrição

    tipo         feat, fix, docs, style, refactor, test, chore, ci
    SCRUM-{ID}   ID da tarefa no Jira, obrigatório em todos os tipos

  Exemplos:
    feat(SCRUM-12): Criação da tela de login
    fix(SCRUM-34): Correção da validação de e-mail
    docs(SCRUM-14): Atualização da documentação dos requisitos

  Padrão completo: docs/padraocommit.md
  Dica: "npm run commit" monta a mensagem no padrão.`;

module.exports = {
  plugins: [
    {
      rules: {
        'padrao-kernel-panic': ({ header }) => [PADRAO.test(header ?? ''), AJUDA],
      },
    },
  ],
  rules: {
    'padrao-kernel-panic': [2, 'always'],
  },
};
