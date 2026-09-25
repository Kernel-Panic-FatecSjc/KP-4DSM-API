-- Substitui o gatilho de avaliação de alertas por uma versão por statement:
-- em vez de rodar uma vez por linha inserida em "medidas", roda uma única vez
-- por INSERT (lote), recebendo todas as linhas novas via tabela de transição
-- ("novas"). A checagem vira um único JOIN contra "alertas" — o custo deixa
-- de escalar com o número de linhas do lote e passa a ser ~constante por
-- lote, o que importa porque o serviço de ingestão agora grava medidas em
-- lotes grandes (ver LoteMedidasService).
--
-- O JOIN já é genérico em relação aos campos de "alertas" (operador,
-- valorLimite, parametroId) e não depende do tipo de parâmetro — qualquer
-- alerta cadastrado para qualquer tipoParametro passa a ser avaliado sem
-- precisar tocar neste trigger.
DROP TRIGGER IF EXISTS trg_avaliar_alerta_medida ON medidas;
DROP FUNCTION IF EXISTS avaliar_alerta_medida();

CREATE OR REPLACE FUNCTION avaliar_alertas_lote()
RETURNS TRIGGER AS $$
DECLARE
  qtd INTEGER;
BEGIN
  INSERT INTO alarmes (id, "disparadoEm", status, "alertaId", "medidaId")
  SELECT gen_random_uuid(), now(), 'ABERTO', a.id, n.id
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

CREATE TRIGGER trg_avaliar_alertas_lote
AFTER INSERT ON medidas
REFERENCING NEW TABLE AS novas
FOR EACH STATEMENT
EXECUTE FUNCTION avaliar_alertas_lote();
