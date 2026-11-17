-- alarmes só tinha a chave primária. O relatório de incidentes (US10) parte
-- das medidas do período (índice em medidas.unixtime) e busca os alarmes de
-- cada uma por "medidaId": sem índice, cada consulta varria a tabela inteira,
-- que cresce um alarme por leitura acima do limiar. "alertaId" serve aos
-- filtros por alerta e ao ON DELETE CASCADE vindo de alertas.
CREATE INDEX "alarmes_medidaId_idx" ON "alarmes"("medidaId");

CREATE INDEX "alarmes_alertaId_idx" ON "alarmes"("alertaId");
