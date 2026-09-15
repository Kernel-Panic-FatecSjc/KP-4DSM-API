/*
  Warnings:

  - Added the required column `severidade` to the `alertas` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SeveridadeAlerta" AS ENUM ('ATENCAO', 'ALERTA', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "StatusAlarme" AS ENUM ('ABERTO', 'RECONHECIDO', 'RESOLVIDO');

-- AlterTable
ALTER TABLE "alarmes" ADD COLUMN     "status" "StatusAlarme" NOT NULL DEFAULT 'ABERTO';

-- AlterTable
ALTER TABLE "alertas" ADD COLUMN     "severidade" "SeveridadeAlerta" NOT NULL;
