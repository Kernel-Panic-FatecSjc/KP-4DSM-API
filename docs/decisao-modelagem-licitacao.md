# Decisão de modelagem — licitações e contratos (RF10)

**Decisão:** licitação será uma entidade própria (`licitacoes`), relacionada opcionalmente a `contratos`.

**Motivo:** o processo licitatório tem identificador e modalidade próprios, enquanto o contrato registra o instrumento conquistado, seu objeto e vigência. Separar evita duplicar número do processo/modalidade em contratos e permite ampliar os dados da licitação sem inflar a tabela de contratos.

**Compatibilidade:** `contratos.licitacaoId` é nullable para permitir contratos sem processo licitatório vinculado. `OrgaoPublico` é o model Prisma associado a `orgaos_publicos`; a migration cria as tabelas `orgaos_publicos`, `licitacoes` e `contratos`. `VIGENTE` é o status de contrato em execução.

**Campos principais:** órgão: nome, CNPJ único, esfera, município e UF; licitação: número do processo único e modalidade; contrato: número único, objeto, órgão, licitação opcional, início/fim da vigência e status.


**Escopo:** modelagem de órgãos públicos, licitações e contratos para o RF10 (SCRUM-70).
