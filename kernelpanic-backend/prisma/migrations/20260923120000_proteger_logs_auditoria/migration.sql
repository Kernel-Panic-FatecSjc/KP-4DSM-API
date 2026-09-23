-- Mantém a trilha de auditoria imutável no banco, inclusive fora da API.
CREATE OR REPLACE FUNCTION impedir_alteracao_logs_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Registros de auditoria são imutáveis';
END;
$$;

CREATE TRIGGER logs_auditoria_somente_insert
BEFORE UPDATE OR DELETE ON "logs_auditoria"
FOR EACH ROW
EXECUTE FUNCTION impedir_alteracao_logs_auditoria();