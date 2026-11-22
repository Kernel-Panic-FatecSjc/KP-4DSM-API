-- Experimento de armazenamento de séries temporais (SCRUM-43): custo de índices
-- em medidas(unixtime) com 10 milhões de medidas.
--
-- Rode num banco só de carga, já migrado e com o cenário de estações criado
-- (npm run teste:carga:http com NUM_ESTACOES=5000 cria 5000 estações x 6
-- parâmetros). Passos, na ordem:
--   1. carregar:   \i teste-carga/armazenamento-series.sql  (seção CARGA, uma vez)
--   2. medir:      seção CONSULTAS, antes e depois de cada índice da seção ÍNDICES
-- Os resultados e a análise estão em docs/teste-de-carga-ingestao.md.
--
-- As medidas entram em ordem cronológica, lote a lote (um lote = um instante
-- para todos os parâmetros), que é como a ingestão as grava: a ordem física da
-- tabela acompanha o unixtime, que é o que faz um índice BRIN funcionar.

-- ============================== CARGA ==============================
-- 333 instantes x 30 mil parâmetros ~ 10 milhões de medidas, 1 por minuto
-- por parâmetro (~5,5 horas de dados da frota). Termina em um instante fixo
-- no passado para as consultas abaixo serem repetíveis.
DO $$
DECLARE
  instantes constant int := 333;
  fim constant bigint := 1792000000;
BEGIN
  FOR k IN 0..instantes - 1 LOOP
    INSERT INTO medidas (id, unixtime, valor, "parametroId", "estacaoId")
    SELECT gen_random_uuid()::text, fim - (instantes - k) * 60, 15 + random() * 10, p.id, p."estacaoId"
    FROM parametros p;
    IF k % 50 = 0 THEN RAISE NOTICE 'instante % de %', k, instantes; END IF;
  END LOOP;
END $$;
ANALYZE medidas;

-- ============================== ÍNDICES ==============================
-- Rode um por vez, medindo as CONSULTAS entre eles; apague antes do próximo.
--   CREATE INDEX medidas_unixtime_btree ON medidas (unixtime);
--   CREATE INDEX medidas_unixtime_brin  ON medidas USING brin (unixtime) WITH (pages_per_range = 32);
--   DROP INDEX medidas_unixtime_btree;  DROP INDEX medidas_unixtime_brin;
--   SELECT pg_size_pretty(pg_relation_size('medidas_unixtime_btree'));

-- ============================== CONSULTAS ==============================
-- O padrão do dashboard (src/dashboard/dashboard.service.ts): janela de tempo,
-- com ou sem estação, ordenada por unixtime, até 5000 linhas.
-- Janela: última hora (3600 s) e últimas 6 horas, terminando em 1792000000.
--
-- Q1: todas as estações, última hora
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM medidas
--   WHERE unixtime BETWEEN 1791996400 AND 1792000000 ORDER BY unixtime ASC LIMIT 5000;
-- Q2: uma estação, últimas 6 horas
--   EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM medidas
--   WHERE "estacaoId" = (SELECT id FROM estacoes ORDER BY vid LIMIT 1)
--     AND unixtime BETWEEN 1791978400 AND 1792000000 ORDER BY unixtime ASC LIMIT 5000;
-- Q3: contagem na última hora (todas as estações)
--   EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM medidas
--   WHERE unixtime BETWEEN 1791996400 AND 1792000000;
