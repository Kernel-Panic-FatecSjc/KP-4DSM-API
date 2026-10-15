/*
  Warnings:

  - A unique constraint covering the columns `[parametroId,unixtime]` on the table `medidas` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "medidas_parametroId_unixtime_idx";

-- CreateIndex
CREATE UNIQUE INDEX "medidas_parametroId_unixtime_key" ON "medidas"("parametroId", "unixtime");
