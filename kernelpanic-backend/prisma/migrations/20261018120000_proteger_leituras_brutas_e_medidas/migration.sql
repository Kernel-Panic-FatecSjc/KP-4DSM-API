-- Mantém os dados originais imutáveis no banco, inclusive fora da API, no
-- mesmo padrão de 20260923120000_proteger_logs_auditoria: leituras_brutas é o
-- payload como chegou do datalogger e medidas é a série histórica derivada
-- dele (os alarmes apontam para ela).
-- Em medidas o trigger também barra o ON DELETE CASCADE vindo de estacoes e
-- parametros: a API só inativa estações e recusa remover sensor com medidas,
-- então só um DELETE manual chegaria lá, e ele passa a falhar.
CREATE OR REPLACE FUNCTION impedir_alteracao_leituras_brutas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Leituras brutas são imutáveis';
END;
$$;

CREATE TRIGGER leituras_brutas_somente_insert
BEFORE UPDATE OR DELETE ON "leituras_brutas"
FOR EACH ROW
EXECUTE FUNCTION impedir_alteracao_leituras_brutas();

CREATE OR REPLACE FUNCTION impedir_alteracao_medidas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Medidas são imutáveis';
END;
$$;

CREATE TRIGGER medidas_somente_insert
BEFORE UPDATE OR DELETE ON "medidas"
FOR EACH ROW
EXECUTE FUNCTION impedir_alteracao_medidas();
