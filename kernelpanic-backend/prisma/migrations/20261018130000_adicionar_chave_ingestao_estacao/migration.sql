-- Chave de ingestão própria de cada estação (só o hash SHA-256). Fica nula
-- nas estações já cadastradas até o administrador gerar a chave delas.
-- AlterTable
ALTER TABLE "estacoes" ADD COLUMN "chaveIngestaoHash" TEXT;
