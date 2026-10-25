-- Modelo por licitação (docs/regras-licitacao.md): contratos e orgaos_publicos
-- viram campos de licitacoes, toda entidade de negócio ganha licitacaoId e os
-- perfis passam a ser ADMIN_TECSUS, ADMIN_LICITACAO e USUARIO_LICITACAO.
--
-- Dados que já existirem não se perdem: estações, tipos de parâmetro, alertas,
-- medidas e leituras com erro vão para a licitação "LEGADO", criada só se
-- houver algum deles (ou algum MONITOR). ADMINISTRADOR vira ADMIN_TECSUS e
-- MONITOR vira USUARIO_LICITACAO da LEGADO. Contratos e órgãos eram dados de
-- teste e são descartados.

CREATE TYPE "StatusLicitacao" AS ENUM ('RASCUNHO', 'VIGENTE', 'SUSPENSA', 'ENCERRADA');

-- Contratos, órgãos e a licitação antiga saem.
ALTER TABLE "estacoes" DROP CONSTRAINT "estacoes_contratoId_fkey";
DROP INDEX "estacoes_contratoId_idx";
ALTER TABLE "estacoes" DROP COLUMN "contratoId";
DROP TABLE "contratos";
DROP TABLE "orgaos_publicos";
DROP TABLE "licitacoes";
DROP TYPE "StatusContrato";

CREATE TABLE "licitacoes" (
    "id" TEXT NOT NULL,
    "codigoIdentificador" TEXT NOT NULL,
    "numeroProcesso" TEXT NOT NULL,
    "modalidade" "ModalidadeLicitacao" NOT NULL,
    "objeto" TEXT NOT NULL,
    "numeroContrato" TEXT NOT NULL,
    "inicioVigencia" TIMESTAMP(3) NOT NULL,
    "fimVigencia" TIMESTAMP(3) NOT NULL,
    "status" "StatusLicitacao" NOT NULL DEFAULT 'RASCUNHO',
    "encerradaEm" TIMESTAMP(3),
    "orgaoNome" TEXT NOT NULL,
    "orgaoCnpj" TEXT,
    "orgaoEsfera" "EsferaOrgao" NOT NULL,
    "orgaoMunicipio" TEXT NOT NULL,
    "orgaoUf" CHAR(2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licitacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "licitacoes_codigoIdentificador_key" ON "licitacoes"("codigoIdentificador");
CREATE UNIQUE INDEX "licitacoes_numeroProcesso_key" ON "licitacoes"("numeroProcesso");
CREATE UNIQUE INDEX "licitacoes_numeroContrato_key" ON "licitacoes"("numeroContrato");
CREATE INDEX "licitacoes_status_idx" ON "licitacoes"("status");

-- Licitação que recebe o que já existia (id fixo para os UPDATEs abaixo).
INSERT INTO "licitacoes" (
    "id", "codigoIdentificador", "numeroProcesso", "modalidade", "objeto",
    "numeroContrato", "inicioVigencia", "fimVigencia", "status",
    "orgaoNome", "orgaoEsfera", "orgaoMunicipio", "orgaoUf", "atualizadoEm"
)
SELECT
    '00000000-0000-4000-8000-000000000001', 'LEGADO', 'LEGADO', 'OUTRA',
    'Dados anteriores ao modelo por licitação', 'LEGADO',
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year', 'VIGENTE',
    'Órgão não informado', 'MUNICIPAL', 'Não informado', 'SP', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "estacoes")
   OR EXISTS (SELECT 1 FROM "tipos_parametro")
   OR EXISTS (SELECT 1 FROM "usuarios" WHERE "tipo" = 'MONITOR');

-- Perfis: o enum antigo some e o tipo deixa de ter padrão (o perfil é sempre
-- escolhido no cadastro).
ALTER TABLE "usuarios" ADD COLUMN "licitacaoId" TEXT;
UPDATE "usuarios" SET "licitacaoId" = '00000000-0000-4000-8000-000000000001' WHERE "tipo" = 'MONITOR';

CREATE TYPE "TipoUsuario_new" AS ENUM ('ADMIN_TECSUS', 'ADMIN_LICITACAO', 'USUARIO_LICITACAO');
ALTER TABLE "usuarios" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "tipo" TYPE "TipoUsuario_new" USING (
    CASE "tipo"::text WHEN 'MONITOR' THEN 'USUARIO_LICITACAO' ELSE 'ADMIN_TECSUS' END
)::"TipoUsuario_new";
ALTER TYPE "TipoUsuario" RENAME TO "TipoUsuario_old";
ALTER TYPE "TipoUsuario_new" RENAME TO "TipoUsuario";
DROP TYPE "TipoUsuario_old";

-- Tecsus não tem licitação; os outros perfis têm exatamente uma.
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_licitacao_conforme_tipo"
    CHECK (("tipo" = 'ADMIN_TECSUS') = ("licitacaoId" IS NULL));

-- licitacaoId nas entidades de negócio: nasce nulo, recebe a LEGADO e só
-- então vira obrigatório.
ALTER TABLE "estacoes" ADD COLUMN "licitacaoId" TEXT;
ALTER TABLE "tipos_parametro" ADD COLUMN "licitacaoId" TEXT;
ALTER TABLE "alertas" ADD COLUMN "licitacaoId" TEXT;
ALTER TABLE "medidas" ADD COLUMN "licitacaoId" TEXT;
ALTER TABLE "leituras_erro" ADD COLUMN "licitacaoId" TEXT;
ALTER TABLE "logs_auditoria" ADD COLUMN "licitacaoId" TEXT;

UPDATE "estacoes" SET "licitacaoId" = '00000000-0000-4000-8000-000000000001';
UPDATE "tipos_parametro" SET "licitacaoId" = '00000000-0000-4000-8000-000000000001';
UPDATE "alertas" SET "licitacaoId" = '00000000-0000-4000-8000-000000000001';

-- medidas e leituras_erro são imutáveis (trigger): a trava sai só durante o
-- preenchimento da coluna nova e volta na mesma transação.
ALTER TABLE "medidas" DISABLE TRIGGER "medidas_somente_insert";
UPDATE "medidas" SET "licitacaoId" = '00000000-0000-4000-8000-000000000001';
ALTER TABLE "medidas" ENABLE TRIGGER "medidas_somente_insert";

ALTER TABLE "leituras_erro" DISABLE TRIGGER "leituras_erro_somente_insert";
UPDATE "leituras_erro" e SET "licitacaoId" = '00000000-0000-4000-8000-000000000001'
WHERE EXISTS (SELECT 1 FROM "estacoes" WHERE "vid" = e."vidEstacao");
ALTER TABLE "leituras_erro" ENABLE TRIGGER "leituras_erro_somente_insert";

ALTER TABLE "estacoes" ALTER COLUMN "licitacaoId" SET NOT NULL;
ALTER TABLE "tipos_parametro" ALTER COLUMN "licitacaoId" SET NOT NULL;
ALTER TABLE "alertas" ALTER COLUMN "licitacaoId" SET NOT NULL;
ALTER TABLE "medidas" ALTER COLUMN "licitacaoId" SET NOT NULL;

CREATE INDEX "usuarios_licitacaoId_idx" ON "usuarios"("licitacaoId");
CREATE INDEX "estacoes_licitacaoId_idx" ON "estacoes"("licitacaoId");
CREATE INDEX "tipos_parametro_licitacaoId_idx" ON "tipos_parametro"("licitacaoId");
CREATE INDEX "alertas_licitacaoId_idx" ON "alertas"("licitacaoId");
CREATE INDEX "medidas_licitacaoId_unixtime_idx" ON "medidas"("licitacaoId", "unixtime");
CREATE INDEX "leituras_erro_licitacaoId_registradoEm_idx" ON "leituras_erro"("licitacaoId", "registradoEm");
CREATE INDEX "logs_auditoria_licitacaoId_criadoEm_idx" ON "logs_auditoria"("licitacaoId", "criadoEm");

-- Exportação CSV em streaming (keyset da mais nova para a mais antiga) e
-- listagens sem filtro: sem estes índices cada lote ordenaria o período inteiro.
CREATE INDEX "logs_auditoria_criadoEm_id_idx" ON "logs_auditoria"("criadoEm", "id");
CREATE INDEX "leituras_brutas_recebidoEm_id_idx" ON "leituras_brutas"("recebidoEm", "id");

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "estacoes" ADD CONSTRAINT "estacoes_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tipos_parametro" ADD CONSTRAINT "tipos_parametro_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Regra de consistência: parâmetro, tipo de parâmetro e alerta ativo são da
-- mesma licitação da estação. Constraint triggers adiados para o fim da
-- transação, para dar para mudar a estação de licitação e trocar os tipos dos
-- parâmetros dela na mesma transação (POST /licitacoes/:id/estacoes). O
-- serviço confere antes e responde 400; o banco é a última barreira.
CREATE OR REPLACE FUNCTION verificar_licitacao_parametro()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF (SELECT "licitacaoId" FROM "estacoes" WHERE "id" = NEW."estacaoId")
       IS DISTINCT FROM
       (SELECT "licitacaoId" FROM "tipos_parametro" WHERE "id" = NEW."tipoParametroId") THEN
        RAISE EXCEPTION 'O tipo de parâmetro % não é da licitação da estação %', NEW."tipoParametroId", NEW."estacaoId"
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "parametros_mesma_licitacao"
AFTER INSERT OR UPDATE ON "parametros"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verificar_licitacao_parametro();

CREATE OR REPLACE FUNCTION verificar_licitacao_estacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "parametros" p
        JOIN "tipos_parametro" t ON t."id" = p."tipoParametroId"
        WHERE p."estacaoId" = NEW."id" AND t."licitacaoId" <> NEW."licitacaoId"
    ) THEN
        RAISE EXCEPTION 'A estação % tem sensores de outra licitação', NEW."id"
            USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
        SELECT 1 FROM "alertas" a
        JOIN "parametros" p ON p."id" = a."parametroId"
        WHERE p."estacaoId" = NEW."id" AND a."ativo" AND a."licitacaoId" <> NEW."licitacaoId"
    ) THEN
        RAISE EXCEPTION 'A estação % tem alertas ativos de outra licitação', NEW."id"
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "estacoes_mesma_licitacao"
AFTER UPDATE OF "licitacaoId" ON "estacoes"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verificar_licitacao_estacao();

CREATE OR REPLACE FUNCTION verificar_licitacao_tipo_parametro()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "parametros" p
        JOIN "estacoes" e ON e."id" = p."estacaoId"
        WHERE p."tipoParametroId" = NEW."id" AND e."licitacaoId" <> NEW."licitacaoId"
    ) THEN
        RAISE EXCEPTION 'O tipo de parâmetro % está em estações de outra licitação', NEW."id"
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "tipos_parametro_mesma_licitacao"
AFTER UPDATE OF "licitacaoId" ON "tipos_parametro"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verificar_licitacao_tipo_parametro();

-- Alerta inativo fica como histórico da licitação em que foi criado; só o
-- ativo precisa acompanhar a estação.
CREATE OR REPLACE FUNCTION verificar_licitacao_alerta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."ativo" AND NEW."licitacaoId" IS DISTINCT FROM (
        SELECT e."licitacaoId" FROM "parametros" p
        JOIN "estacoes" e ON e."id" = p."estacaoId"
        WHERE p."id" = NEW."parametroId"
    ) THEN
        RAISE EXCEPTION 'O alerta % não é da licitação da estação do parâmetro', NEW."id"
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "alertas_mesma_licitacao"
AFTER INSERT OR UPDATE ON "alertas"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION verificar_licitacao_alerta();

-- Serviço de tratamento (docs/mqtt-topico-payload.md): a coluna guarda a
-- transação que gravou cada leitura bruta. A tabela é reescrita com o xid desta
-- migration nas linhas antigas (ADD COLUMN não dispara o trigger de UPDATE).
ALTER TABLE "leituras_brutas" ADD COLUMN "xidTransacao" BIGINT NOT NULL DEFAULT ((pg_current_xact_id())::text)::bigint;
CREATE INDEX "leituras_brutas_xidTransacao_id_idx" ON "leituras_brutas"("xidTransacao", "id");

-- O pacote de um vid sem estação (só possível pela rota HTTP aberta em
-- desenvolvimento) agora fica em leituras_brutas e o tratamento registra o motivo.
ALTER TYPE "MotivoLeituraErro" ADD VALUE 'ESTACAO_NAO_CADASTRADA' BEFORE 'SENSOR_NAO_CONFIGURADO';

CREATE TABLE "controle_tratamento" (
    "id" TEXT NOT NULL,
    "ultimoXid" BIGINT NOT NULL DEFAULT 0,
    "ultimaLeituraId" TEXT NOT NULL DEFAULT '',
    "processadas" BIGINT NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "controle_tratamento_pkey" PRIMARY KEY ("id")
);

-- As leituras brutas que já existem foram processadas pela ingestão antiga
-- (que gerava as medidas na hora): o marcador começa depois delas, no xid
-- desta migration e acima de qualquer uuid.
INSERT INTO "controle_tratamento" ("id", "ultimoXid", "ultimaLeituraId")
VALUES ('leituras_brutas', ((pg_current_xact_id())::text)::bigint, 'ffffffff-ffff-ffff-ffff-ffffffffffff');

-- Acorda o serviço de tratamento a cada lote gravado (LISTEN), para a leitura
-- virar medida sem esperar o próximo ciclo de varredura. Um aviso por INSERT,
-- não por linha; só chega depois do commit.
CREATE OR REPLACE FUNCTION avisar_leituras_brutas_novas()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_notify('leituras_brutas_novas', '');
    RETURN NULL;
END;
$$;

CREATE TRIGGER "leituras_brutas_avisar_novas"
AFTER INSERT ON "leituras_brutas"
FOR EACH STATEMENT
EXECUTE FUNCTION avisar_leituras_brutas_novas();
