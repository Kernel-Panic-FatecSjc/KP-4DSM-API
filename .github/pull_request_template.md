<!--
Título: tipo(SCRUM-{ID}): descrição          ex.: feat(SCRUM-12): Criação da tela de login
Branch: tipo/SCRUM-{ID}-descricao-curta       ex.: feat/SCRUM-12-tela-de-login
Destino: main. Para testar rodando, o revisor coloca o label staging no PR. Precisa de 1 aprovação; PR docs só de documentação não precisa.
Fluxo completo: docs/estrategiabranch.md
-->

## O que muda

<!-- O que a tarefa entrega e como testar. -->

## Banco de dados (só se o PR altera `prisma/migrations`)

<!--
Apague esta seção se o PR não tem migration. Se tem, o check "Double check de
banco" exige aqui o link do registro de aprovação no Confluence, assinado por
2 devs (política de banco 7.2), inclusive em hotfix.
-->

- Registro de aprovação (Confluence): cole aqui (https://<time>.atlassian.net/wiki/<página>)
- [ ] SQL gerado pelo Prisma revisado; SQL manual justificado e testado
- [ ] Riscos de lock, perda de dados, índices e integridade avaliados
- [ ] Mudança incompatível segue expand/contract, com as tarefas das próximas fases
- [ ] Procedimento de recuperação definido para mudança crítica (o rollback do código não desfaz o banco)
- [ ] Evidência de carga ou medição registrada, se a mudança pode afetar desempenho
