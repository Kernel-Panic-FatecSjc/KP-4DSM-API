// Perguntas do `npm run commit` (commitizen + cz-customizable). Gera mensagens
// no padrão validado pelo commit-msg (.commitlintrc.cjs) e pela CI
// (.github/workflows/padrao-commit-pr.yaml): tipo(id-da-task): resumo
// https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API/wiki/Dev-Padrao-de-commit
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

  // O id da task entra como ticket, obrigatório e com o mesmo formato de
  // escopo que a CI aceita. O cz-customizable escreve o ticket depois do
  // separador, então o prefixo e o sufixo montam os parênteses e o separador
  // fica vazio: "feat" + "(US06-02): " + "resumo".
  scopes: [],
  skipEmptyScopes: true,
  allowTicketNumber: true,
  isTicketNumberRequired: true,
  ticketNumberRegExp: 'US[0-9]{2}-[0-9]{2}|#[0-9]+|[Nn]ot-[Uu][Ss]',
  ticketNumberPrefix: '(',
  ticketNumberSuffix: '):',
  subjectSeparator: '',

  messages: {
    type: 'Tipo da mudança:',
    ticketNumber: 'Id da task (US06-02 = tarefa de User Story, #39 = issue, not-US = sem vínculo):\n',
    subject: 'Resumo curto da mudança:\n',
    body: 'Descrição mais longa (opcional). Use "|" para quebrar linha:\n',
    confirmCommit: 'Confirmar o commit acima?',
  },

  skipQuestions: ['footer'],
  subjectLimit: 72,
};
