-- TRUNCATE não dispara trigger FOR EACH ROW: um TRUNCATE manual apagava
-- leituras_brutas, medidas e leituras_erro mesmo com a proteção contra UPDATE
-- e DELETE (20261018120000_proteger_leituras_brutas_e_medidas e
-- 20261019220000_criar_leituras_erro). Um trigger BEFORE TRUNCATE por
-- statement, com as mesmas funções, fecha essa porta nas três tabelas (US16).
CREATE TRIGGER leituras_brutas_sem_truncate
BEFORE TRUNCATE ON "leituras_brutas"
FOR EACH STATEMENT
EXECUTE FUNCTION impedir_alteracao_leituras_brutas();

CREATE TRIGGER medidas_sem_truncate
BEFORE TRUNCATE ON "medidas"
FOR EACH STATEMENT
EXECUTE FUNCTION impedir_alteracao_medidas();

CREATE TRIGGER leituras_erro_sem_truncate
BEFORE TRUNCATE ON "leituras_erro"
FOR EACH STATEMENT
EXECUTE FUNCTION impedir_alteracao_leituras_erro();
