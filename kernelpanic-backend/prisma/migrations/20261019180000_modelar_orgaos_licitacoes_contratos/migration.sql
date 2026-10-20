CREATE TYPE "EsferaOrgao" AS ENUM (
    'MUNICIPAL',
    'ESTADUAL',
    'FEDERAL'
);

CREATE TYPE "ModalidadeLicitacao" AS ENUM (
    'PREGAO',
    'CONCORRENCIA',
    'CONCURSO',
    'LEILAO',
    'DIALOGO_COMPETITIVO',
    'DISPENSA',
    'INEXIGIBILIDADE',
    'OUTRA'
);

CREATE TYPE "StatusContrato" AS ENUM (
    'RASCUNHO',
    'ATIVO',
    'VIGENTE',
    'SUSPENSO',
    'ENCERRADO'
);

CREATE TABLE "orgaos_publicos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "esfera" "EsferaOrgao" NOT NULL,
    "municipio" TEXT NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orgaos_publicos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orgaos_publicos_cnpj_key"
    ON "orgaos_publicos"("cnpj");

CREATE TABLE "licitacoes" (
    "id" TEXT NOT NULL,
    "numeroProcesso" TEXT NOT NULL,
    "modalidade" "ModalidadeLicitacao" NOT NULL,
    "objeto" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licitacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "licitacoes_numeroProcesso_key"
    ON "licitacoes"("numeroProcesso");

CREATE INDEX "licitacoes_modalidade_idx"
    ON "licitacoes"("modalidade");

CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "inicioVigencia" TIMESTAMP(3) NOT NULL,
    "fimVigencia" TIMESTAMP(3) NOT NULL,
    "status" "StatusContrato" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "encerradoEm" TIMESTAMP(3),
    "orgaoId" TEXT NOT NULL,
    "licitacaoId" TEXT,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contratos_numero_key"
    ON "contratos"("numero");

CREATE INDEX "contratos_orgaoId_idx"
    ON "contratos"("orgaoId");

CREATE INDEX "contratos_status_idx"
    ON "contratos"("status");

CREATE INDEX "contratos_licitacaoId_idx"
    ON "contratos"("licitacaoId");

ALTER TABLE "contratos"
    ADD CONSTRAINT "contratos_orgaoId_fkey"
    FOREIGN KEY ("orgaoId")
    REFERENCES "orgaos_publicos"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

ALTER TABLE "contratos"
    ADD CONSTRAINT "contratos_licitacaoId_fkey"
    FOREIGN KEY ("licitacaoId")
    REFERENCES "licitacoes"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
