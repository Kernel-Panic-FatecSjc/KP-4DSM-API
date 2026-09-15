-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADMINISTRADOR', 'MONITOR');

-- CreateEnum
CREATE TYPE "OperadorAlerta" AS ENUM ('MAIOR_QUE', 'MENOR_QUE', 'IGUAL_A', 'MAIOR_OU_IGUAL', 'MENOR_OU_IGUAL');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "tipo" "TipoUsuario" NOT NULL DEFAULT 'ADMINISTRADOR';

-- CreateTable
CREATE TABLE "estacoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "vid" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "estacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_parametro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "fator" DOUBLE PRECISION NOT NULL,
    "ganho" DOUBLE PRECISION NOT NULL,
    "json" JSONB,

    CONSTRAINT "tipos_parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros" (
    "id" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estacaoId" TEXT NOT NULL,
    "tipoParametroId" TEXT NOT NULL,

    CONSTRAINT "parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medidas" (
    "id" TEXT NOT NULL,
    "unixtime" BIGINT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "parametroId" TEXT NOT NULL,
    "estacaoId" TEXT NOT NULL,

    CONSTRAINT "medidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "operador" "OperadorAlerta" NOT NULL,
    "valorLimite" DOUBLE PRECISION NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parametroId" TEXT NOT NULL,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarmes" (
    "id" TEXT NOT NULL,
    "disparadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "alertaId" TEXT NOT NULL,
    "medidaId" TEXT NOT NULL,

    CONSTRAINT "alarmes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estacoes_vid_key" ON "estacoes"("vid");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_estacaoId_tipoParametroId_key" ON "parametros"("estacaoId", "tipoParametroId");

-- CreateIndex
CREATE INDEX "medidas_parametroId_unixtime_idx" ON "medidas"("parametroId", "unixtime");

-- CreateIndex
CREATE INDEX "medidas_estacaoId_unixtime_idx" ON "medidas"("estacaoId", "unixtime");

-- AddForeignKey
ALTER TABLE "estacoes" ADD CONSTRAINT "estacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_estacaoId_fkey" FOREIGN KEY ("estacaoId") REFERENCES "estacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_tipoParametroId_fkey" FOREIGN KEY ("tipoParametroId") REFERENCES "tipos_parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "parametros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_estacaoId_fkey" FOREIGN KEY ("estacaoId") REFERENCES "estacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "parametros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alertas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_medidaId_fkey" FOREIGN KEY ("medidaId") REFERENCES "medidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
