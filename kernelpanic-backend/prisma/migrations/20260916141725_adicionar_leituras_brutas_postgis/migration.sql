-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateTable
CREATE TABLE "leituras_brutas" (
    "id" TEXT NOT NULL,
    "vidEstacao" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "localizacao" geometry(Point, 4326) NOT NULL,
    "unixtimeDispositivo" BIGINT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leituras_brutas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leituras_brutas_vidEstacao_recebidoEm_idx" ON "leituras_brutas"("vidEstacao", "recebidoEm");
