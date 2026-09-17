-- AlterEnum
ALTER TYPE "OperadorAlerta" ADD VALUE 'DIFERENTE_DE';

-- Trigger de avaliação de alertas: dispara sempre que uma nova "medida" é
-- inserida, comparando o valor lido contra todos os alertas ativos daquele
-- parâmetro. Regra que dispara vira uma linha em "alarmes", automaticamente,
-- sem depender de nenhum código de aplicação rodar. É intencionalmente SQL
-- puro (não modelado no schema.prisma) — Prisma não tem como expressar
-- triggers, então isso é gerenciado só via migration.
CREATE OR REPLACE FUNCTION avaliar_alerta_medida()
RETURNS TRIGGER AS $$
DECLARE
  regra RECORD;
  condicao_atendida BOOLEAN;
BEGIN
  FOR regra IN
    SELECT id, operador, "valorLimite"
    FROM alertas
    WHERE "parametroId" = NEW."parametroId" AND ativo = true
  LOOP
    condicao_atendida := CASE regra.operador
      WHEN 'MAIOR_QUE' THEN NEW.valor > regra."valorLimite"
      WHEN 'MENOR_QUE' THEN NEW.valor < regra."valorLimite"
      WHEN 'IGUAL_A' THEN NEW.valor = regra."valorLimite"
      WHEN 'DIFERENTE_DE' THEN NEW.valor != regra."valorLimite"
      WHEN 'MAIOR_OU_IGUAL' THEN NEW.valor >= regra."valorLimite"
      WHEN 'MENOR_OU_IGUAL' THEN NEW.valor <= regra."valorLimite"
      ELSE false
    END;

    IF condicao_atendida THEN
      INSERT INTO alarmes (id, "disparadoEm", status, "alertaId", "medidaId")
      VALUES (gen_random_uuid(), now(), 'ABERTO', regra.id, NEW.id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_avaliar_alerta_medida ON medidas;

CREATE TRIGGER trg_avaliar_alerta_medida
AFTER INSERT ON medidas
FOR EACH ROW
EXECUTE FUNCTION avaliar_alerta_medida();
