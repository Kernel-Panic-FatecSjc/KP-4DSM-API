-- "disparadoEm" é timestamp sem fuso, e o Prisma lê/grava essas colunas como
-- UTC. O trigger usava now(), que é convertido para o TimeZone da sessão: em
-- um Postgres fora de UTC (ex.: America/Sao_Paulo) o alarme ficava gravado
-- com o horário local e aparecia deslocado no histórico — e o tempo real,
-- que busca alarmes dos últimos minutos, deixava de enxergá-lo.
-- Só muda o valor de "disparadoEm"; o restante é idêntico à versão anterior.
CREATE OR REPLACE FUNCTION avaliar_alertas_lote()
RETURNS TRIGGER AS $$
DECLARE
  qtd INTEGER;
BEGIN
  INSERT INTO alarmes (id, "disparadoEm", status, "alertaId", "medidaId")
  SELECT gen_random_uuid(), now() AT TIME ZONE 'UTC', 'ABERTO', a.id, n.id
  FROM novas n
  JOIN alertas a
    ON a."parametroId" = n."parametroId"
   AND a.ativo = true
  WHERE CASE a.operador
    WHEN 'MAIOR_QUE' THEN n.valor > a."valorLimite"
    WHEN 'MENOR_QUE' THEN n.valor < a."valorLimite"
    WHEN 'IGUAL_A' THEN n.valor = a."valorLimite"
    WHEN 'DIFERENTE_DE' THEN n.valor != a."valorLimite"
    WHEN 'MAIOR_OU_IGUAL' THEN n.valor >= a."valorLimite"
    WHEN 'MENOR_OU_IGUAL' THEN n.valor <= a."valorLimite"
    ELSE false
  END;

  GET DIAGNOSTICS qtd = ROW_COUNT;
  IF qtd > 0 THEN
    -- Só chega a quem estiver escutando após o commit do lote — nunca antes,
    -- então ninguém é avisado de um alarme que um rollback desfez.
    PERFORM pg_notify('novos_alarmes', qtd::text);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
