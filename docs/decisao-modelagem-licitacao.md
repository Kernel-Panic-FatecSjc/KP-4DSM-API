# Decisão de modelagem — licitações e contratos (RF10)

**Decisão:** licitação será uma entidade própria (`licitacoes`), relacionada opcionalmente a `contratos`.

**Motivo:** o processo licitatório tem identificador e modalidade próprios, enquanto o contrato registra o instrumento conquistado, seu objeto e vigência. Separar evita duplicar número do processo/modalidade em contratos e permite ampliar os dados da licitação sem inflar a tabela de contratos.

**Compatibilidade:** `contratos.licitacaoId` é nullable para preservar contratos existentes e permitir cadastros legados. O model Prisma `Orgao` foi mantido para não quebrar referências existentes no código, mas sua tabela física passa a ser `orgaos_publicos`. A migração renomeia a tabela existente, preservando os dados e índices. O status legado `ATIVO` continua aceito; `VIGENTE` foi acrescentado para atender à nomenclatura solicitada sem quebrar serviços atuais.

**Campos principais:** órgão: nome, CNPJ único, esfera, município e UF; licitação: número do processo único e modalidade; contrato: número único, objeto, órgão, licitação opcional, início/fim da vigência e status.
