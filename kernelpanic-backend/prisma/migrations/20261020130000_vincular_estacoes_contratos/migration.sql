-- Restabelece o vínculo estação/contrato depois que a migração de main
-- removeu contratos e órgãos.
ALTER TABLE "estacoes"
ADD COLUMN "contratoId" TEXT;

CREATE INDEX "estacoes_contratoId_idx" ON "estacoes"("contratoId");

ALTER TABLE "estacoes"
ADD CONSTRAINT "estacoes_contratoId_fkey"
FOREIGN KEY ("contratoId") REFERENCES "contratos"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
