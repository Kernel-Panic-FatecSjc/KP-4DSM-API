-- Índice btree em medidas(unixtime) para a consulta por janela de tempo sem
-- filtrar a estação (dashboard geral: WHERE unixtime BETWEEN ... ORDER BY
-- unixtime LIMIT 5000). Com 10 milhões de medidas ela caiu de 1,3 s para 17 ms
-- (docs/teste-de-carga-ingestao.md). Um BRIN foi medido e não ajuda: ele não
-- entrega ordem, então o Postgres lê a janela inteira e ordena.
-- Em tabela já grande, em produção, prefira criar antes, fora da migration, com
-- CREATE INDEX CONCURRENTLY (a migration roda numa transação e trava as
-- gravações durante a criação).
CREATE INDEX "medidas_unixtime_idx" ON "medidas"("unixtime");
