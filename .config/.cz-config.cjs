// Perguntas do `npm run commit` (commitizen + cz-customizable). Gera mensagens
// no padrão validado pelo commit-msg (.commitlintrc.cjs) e pela CI
// (.github/workflows/padrao-commit-pr.yaml): tipo(SCRUM-{ID}): descrição
// Padrão completo: docs/padraocommit.md
module.exports = {
  types: [
    { value: 'feat', name: 'feat:     nova funcionalidade' },
    { value: 'fix', name: 'fix:      correção de bug' },
    { value: 'refactor', name: 'refactor: mudança de código sem alterar comportamento' },
    { value: 'style', name: 'style:    formatação e estilo, sem mudança de lógica' },
    { value: 'test', name: 'test:     criação ou alteração de testes' },
    { value: 'docs', name: 'docs:     documentação' },
    { value: 'chore', name: 'chore:    manutenção que não afeta o sistema (dependências, configs)' },
    { value: 'ci', name: 'ci:       pipelines de integração contínua e deploy' },
  ],

  // O id da task entra como ticket, obrigatório e com o mesmo formato de
  // ID que a CI aceita. O cz-customizable escreve o ticket depois do
  // separador, então o prefixo e o sufixo montam os parênteses e o separador
  // fica vazio: "feat" + "(SCRUM-12): " + "resumo".
  scopes: [],
  skipEmptyScopes: true,
  allowTicketNumber: true,
  isTicketNumberRequired: true,
  ticketNumberRegExp: 'SCRUM-[0-9]+',
  ticketNumberPrefix: '(',
  ticketNumberSuffix: '):',
  subjectSeparator: '',

  messages: {
    type: 'Tipo da mudança:',
    ticketNumber: 'ID da tarefa no Jira (ex: SCRUM-12):\n',
    subject: 'Resumo curto da mudança:\n',
    body: 'Descrição mais longa (opcional). Use "|" para quebrar linha:\n',
    confirmCommit: 'Confirmar o commit acima?',
  },

  skipQuestions: ['footer'],
  subjectLimit: 72,
};
