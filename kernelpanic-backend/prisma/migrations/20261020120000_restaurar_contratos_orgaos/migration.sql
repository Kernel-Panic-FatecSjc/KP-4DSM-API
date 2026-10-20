CREATE TYPE "StatusContrato" AS ENUM ('RASCUNHO', 'ATIVO', 'SUSPENSO', 'ENCERRADO');

CREATE TABLE "orgaos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orgaos_pkey" PRIMARY KEY ("id")
);

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
    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "orgaos_cnpj_key" ON "orgaos"("cnpj");
CREATE UNIQUE INDEX "contratos_numero_key" ON "contratos"("numero");
CREATE INDEX "contratos_orgaoId_idx" ON "contratos"("orgaoId");
CREATE INDEX "contratos_status_idx" ON "contratos"("status");

ALTER TABLE "contratos" ADD CONSTRAINT "contratos_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "orgaos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
