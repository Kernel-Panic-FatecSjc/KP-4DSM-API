// Valida a mensagem no hook commit-msg com a mesma regra da CI
// (.github/workflows/padrao-commit-pr.yaml). Se mudar o padrão lá, mude aqui.
const ESCOPO = 'US[0-9]{2}-[0-9]{2}|#[0-9]+|[Nn]ot-[Uu][Ss]';
const PADRAO = new RegExp(
  `^((feat|fix|style|refactor|test)\\((${ESCOPO})\\)|(docs|chore)(\\((${ESCOPO})\\))?): .+`,
);

const AJUDA = `mensagem fora do padrão.

  Formato esperado:  tipo(escopo): resumo

    tipo     feat, fix, docs, style, chore, refactor, test
    escopo   US02-04   tarefa de User Story (história-tarefa)
             #39       tarefa de item técnico (número da issue)
             not-US    sem vínculo com história ou issue
             omitido   somente para docs e chore

  Exemplos:
    feat(US01-02): implementar login JWT em cookie e CRUD de usuários
    fix(not-US): corrigir import do PassportModule
    docs: atualização do README

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
