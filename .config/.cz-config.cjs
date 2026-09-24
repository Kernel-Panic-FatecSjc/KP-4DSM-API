// Perguntas do `npm run commit` (commitizen + cz-customizable). Gera mensagens
// no padrão validado pelo commit-msg (.commitlintrc.cjs) e pela CI
// (.github/workflows/padrao-commit-pr.yaml): tipo(escopo): resumo
// https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API/wiki/Dev-Padrao-de-commit
const ESCOPO_NOT_US = { name: 'not-US   sem vínculo com história ou issue', value: 'not-US' };

module.exports = {
  types: [
    { value: 'feat', name: 'feat:     nova funcionalidade' },
    { value: 'fix', name: 'fix:      correção de bug' },
    { value: 'refactor', name: 'refactor: mudança de código sem alterar comportamento' },
    { value: 'style', name: 'style:    formatação e estilo, sem mudança de lógica' },
    { value: 'test', name: 'test:     criação ou alteração de testes' },
    { value: 'docs', name: 'docs:     documentação' },
    { value: 'chore', name: 'chore:    manutenção que não afeta o sistema (dependências, CI, configs)' },
  ],

  // "custom" pede o escopo digitado (US06-02 ou #39) e "empty" deixa sem
  // escopo, o que o padrão só aceita em docs e chore.
  scopes: [ESCOPO_NOT_US],
  allowCustomScopes: true,

  messages: {
    type: 'Tipo da mudança:',
    scope: '\nEscopo (custom = tarefa de US ou issue; empty = sem escopo, só docs/chore):',
    customScope: 'Escopo, ex.: US06-02 (tarefa de User Story) ou #39 (issue):',
    subject: 'Resumo curto da mudança:\n',
    body: 'Descrição mais longa (opcional). Use "|" para quebrar linha:\n',
    confirmCommit: 'Confirmar o commit acima?',
  },

  skipQuestions: ['footer'],
  subjectLimit: 72,
};
