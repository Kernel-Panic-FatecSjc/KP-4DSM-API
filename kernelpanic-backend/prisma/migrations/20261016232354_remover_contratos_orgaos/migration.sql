-- Desfaz 20261014120000_adicionar_contratos_orgaos: a SCRUM-72 foi revertida
-- por ter entrado na main sem review e volta com uma migration nova.
ALTER TABLE "contratos" DROP CONSTRAINT "contratos_orgaoId_fkey";
DROP TABLE "contratos";
DROP TABLE "orgaos";
DROP TYPE "StatusContrato";
