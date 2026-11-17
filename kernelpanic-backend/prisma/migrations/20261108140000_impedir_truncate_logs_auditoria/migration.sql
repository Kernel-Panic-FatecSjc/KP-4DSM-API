-- A trilha de auditoria barra UPDATE e DELETE por trigger por linha
-- (20260923120000_proteger_logs_auditoria), mas TRUNCATE não dispara esse
-- trigger: um TRUNCATE direto no banco apagava a trilha inteira. O trigger
-- BEFORE TRUNCATE por statement fecha essa porta (US17, RNF14.5).
CREATE TRIGGER logs_auditoria_sem_truncate
BEFORE TRUNCATE ON "logs_auditoria"
FOR EACH STATEMENT
EXECUTE FUNCTION impedir_alteracao_logs_auditoria();
