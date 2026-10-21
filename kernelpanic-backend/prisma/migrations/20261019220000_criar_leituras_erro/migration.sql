-- Registra as leituras que a ingestão recebeu mas não gravou como medida
-- (valor fora da faixa do sensor, ou sensor sem parâmetro na estação). O
-- pacote original segue intacto em leituras_brutas.
-- Imutável, no mesmo padrão de 20261018120000_proteger_leituras_brutas_e_medidas:
-- o registro do que foi recusado não pode ser alterado nem apagado depois.
CREATE TYPE "MotivoLeituraErro" AS ENUM ('SENSOR_NAO_CONFIGURADO', 'ABAIXO_DO_MINIMO', 'ACIMA_DO_MAXIMO');

CREATE TABLE "leituras_erro" (
    "id" TEXT NOT NULL,
    "leituraBrutaId" TEXT NOT NULL,
    "vidEstacao" TEXT NOT NULL,
    "nomeSensor" TEXT NOT NULL,
    "parametroId" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "unixtime" BIGINT NOT NULL,
    "motivo" "MotivoLeituraErro" NOT NULL,
    "valorMinimo" DOUBLE PRECISION,
    "valorMaximo" DOUBLE PRECISION,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leituras_erro_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leituras_erro_leituraBrutaId_idx" ON "leituras_erro"("leituraBrutaId");

CREATE INDEX "leituras_erro_vidEstacao_registradoEm_idx" ON "leituras_erro"("vidEstacao", "registradoEm");


CREATE OR REPLACE FUNCTION impedir_alteracao_leituras_erro()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Leituras com erro são imutáveis';
END;
$$;

CREATE TRIGGER leituras_erro_somente_insert
BEFORE UPDATE OR DELETE ON "leituras_erro"
FOR EACH ROW
EXECUTE FUNCTION impedir_alteracao_leituras_erro();
