-- Ações correlacionadas de cada alarme (US10, relatório de incidentes): quem
-- reconheceu e quem resolveu, quando, e a observação de quem tratou. Antes
-- isso só existia na trilha de auditoria, sem ligação direta com o alarme.
-- Alarmes já tratados ficam com os campos nulos: a trilha continua sendo a
-- fonte para o histórico anterior a esta migration.
ALTER TABLE "alarmes"
ADD COLUMN "reconhecidoEm" TIMESTAMP(3),
ADD COLUMN "reconhecidoPorId" TEXT,
ADD COLUMN "resolvidoEm" TIMESTAMP(3),
ADD COLUMN "resolvidoPorId" TEXT,
ADD COLUMN "observacao" TEXT;

ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_reconhecidoPorId_fkey" FOREIGN KEY ("reconhecidoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
