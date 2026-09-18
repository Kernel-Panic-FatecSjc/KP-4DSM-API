-- CreateEnum
CREATE TYPE "StatusOperacionalEstacao" AS ENUM ('ATIVA', 'INATIVA');

-- AlterTable
ALTER TABLE "estacoes"
ADD COLUMN "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "statusOperacional" "StatusOperacionalEstacao" NOT NULL DEFAULT 'ATIVA';