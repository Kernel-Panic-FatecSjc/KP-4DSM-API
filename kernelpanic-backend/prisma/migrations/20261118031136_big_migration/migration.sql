-- Big Migration (SCRUM-148): consolida as 26 migrations de 20260909135442 a
-- 20261108150000 numa só, no estado que elas produziam juntas. Nada muda no
-- schema: o PR traz a prova (catálogo do banco igual antes e depois).
-- Parte 1 foi gerada pelo Prisma (migrate diff --from-empty --to-schema);
-- a ordem do enum OperadorAlerta foi mantida como no banco (DIFERENTE_DE por
-- último). A parte 2 é o SQL manual que o Prisma não representa, copiado do
-- banco gerado pelas 26 (pg_dump). O histórico de cada objeto está no git.

-- ============================================================================
-- Parte 1: tabelas, enums, índices e chaves (Prisma)
-- ============================================================================
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "TipoUsuario" AS ENUM ('ADMIN_TECSUS', 'ADMIN_LICITACAO', 'USUARIO_LICITACAO');

-- CreateEnum
CREATE TYPE "OperadorAlerta" AS ENUM ('MAIOR_QUE', 'MENOR_QUE', 'IGUAL_A', 'MAIOR_OU_IGUAL', 'MENOR_OU_IGUAL', 'DIFERENTE_DE');

-- CreateEnum
CREATE TYPE "SeveridadeAlerta" AS ENUM ('ATENCAO', 'ALERTA', 'EMERGENCIA');

-- CreateEnum
CREATE TYPE "StatusAlarme" AS ENUM ('ABERTO', 'RECONHECIDO', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "StatusOperacionalEstacao" AS ENUM ('ATIVA', 'INATIVA');

-- CreateEnum
CREATE TYPE "EsferaOrgao" AS ENUM ('MUNICIPAL', 'ESTADUAL', 'FEDERAL');

-- CreateEnum
CREATE TYPE "ModalidadeLicitacao" AS ENUM ('PREGAO', 'CONCORRENCIA', 'CONCURSO', 'LEILAO', 'DIALOGO_COMPETITIVO', 'DISPENSA', 'INEXIGIBILIDADE', 'OUTRA');

-- CreateEnum
CREATE TYPE "StatusLicitacao" AS ENUM ('RASCUNHO', 'VIGENTE', 'SUSPENSA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "AgregacaoParametro" AS ENUM ('SOMA', 'MEDIA');

-- CreateEnum
CREATE TYPE "MotivoLeituraErro" AS ENUM ('ESTACAO_NAO_CADASTRADA', 'SENSOR_NAO_CONFIGURADO', 'ABAIXO_DO_MINIMO', 'ACIMA_DO_MAXIMO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoUsuario" NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "licitacaoId" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "estacoes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "vid" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longitude" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statusOperacional" "StatusOperacionalEstacao" NOT NULL DEFAULT 'ATIVA',
    "chaveIngestaoHash" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "licitacaoId" TEXT NOT NULL,

    CONSTRAINT "estacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_parametro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "fator" DOUBLE PRECISION NOT NULL,
    "ganho" DOUBLE PRECISION NOT NULL,
    "json" JSONB,
    "agregacao" "AgregacaoParametro" NOT NULL DEFAULT 'MEDIA',
    "valorMinimo" DOUBLE PRECISION,
    "valorMaximo" DOUBLE PRECISION,
    "licitacaoId" TEXT NOT NULL,

    CONSTRAINT "tipos_parametro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametros" (
    "id" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estacaoId" TEXT NOT NULL,
    "tipoParametroId" TEXT NOT NULL,

    CONSTRAINT "parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medidas" (
    "id" TEXT NOT NULL,
    "unixtime" BIGINT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "parametroId" TEXT NOT NULL,
    "estacaoId" TEXT NOT NULL,
    "licitacaoId" TEXT NOT NULL,

    CONSTRAINT "medidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" TEXT NOT NULL,
    "operador" "OperadorAlerta" NOT NULL,
    "valorLimite" DOUBLE PRECISION NOT NULL,
    "severidade" "SeveridadeAlerta" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parametroId" TEXT NOT NULL,
    "licitacaoId" TEXT NOT NULL,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarmes" (
    "id" TEXT NOT NULL,
    "disparadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusAlarme" NOT NULL DEFAULT 'ABERTO',
    "alertaId" TEXT NOT NULL,
    "medidaId" TEXT NOT NULL,
    "reconhecidoEm" TIMESTAMP(3),
    "reconhecidoPorId" TEXT,
    "resolvidoEm" TIMESTAMP(3),
    "resolvidoPorId" TEXT,
    "observacao" TEXT,

    CONSTRAINT "alarmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leituras_brutas" (
    "id" TEXT NOT NULL,
    "vidEstacao" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "localizacao" geometry(Point, 4326) NOT NULL,
    "unixtimeDispositivo" BIGINT NOT NULL,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "xidTransacao" BIGINT NOT NULL DEFAULT ((pg_current_xact_id())::text)::bigint,

    CONSTRAINT "leituras_brutas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "licitacaoId" TEXT,

    CONSTRAINT "leituras_erro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "detalhes" JSONB,
    "enderecoIp" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT,
    "licitacaoId" TEXT,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "controle_tratamento" (
    "id" TEXT NOT NULL,
    "ultimoXid" BIGINT NOT NULL DEFAULT 0,
    "ultimaLeituraId" TEXT NOT NULL DEFAULT '',
    "processadas" BIGINT NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "controle_tratamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_licitacaoId_idx" ON "usuarios"("licitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "licitacoes_codigoIdentificador_key" ON "licitacoes"("codigoIdentificador");

-- CreateIndex
CREATE UNIQUE INDEX "licitacoes_numeroProcesso_key" ON "licitacoes"("numeroProcesso");

-- CreateIndex
CREATE UNIQUE INDEX "licitacoes_numeroContrato_key" ON "licitacoes"("numeroContrato");

-- CreateIndex
CREATE INDEX "licitacoes_status_idx" ON "licitacoes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "estacoes_vid_key" ON "estacoes"("vid");

-- CreateIndex
CREATE INDEX "estacoes_licitacaoId_idx" ON "estacoes"("licitacaoId");

-- CreateIndex
CREATE INDEX "tipos_parametro_licitacaoId_idx" ON "tipos_parametro"("licitacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "parametros_estacaoId_tipoParametroId_key" ON "parametros"("estacaoId", "tipoParametroId");

-- CreateIndex
CREATE INDEX "medidas_estacaoId_unixtime_idx" ON "medidas"("estacaoId", "unixtime");

-- CreateIndex
CREATE INDEX "medidas_unixtime_idx" ON "medidas"("unixtime");

-- CreateIndex
CREATE INDEX "medidas_licitacaoId_unixtime_idx" ON "medidas"("licitacaoId", "unixtime");

-- CreateIndex
CREATE UNIQUE INDEX "medidas_parametroId_unixtime_key" ON "medidas"("parametroId", "unixtime");

-- CreateIndex
CREATE INDEX "alertas_licitacaoId_idx" ON "alertas"("licitacaoId");

-- CreateIndex
CREATE INDEX "alarmes_medidaId_idx" ON "alarmes"("medidaId");

-- CreateIndex
CREATE INDEX "alarmes_alertaId_idx" ON "alarmes"("alertaId");

-- CreateIndex
CREATE INDEX "leituras_brutas_vidEstacao_recebidoEm_idx" ON "leituras_brutas"("vidEstacao", "recebidoEm");

-- CreateIndex
CREATE INDEX "leituras_brutas_xidTransacao_id_idx" ON "leituras_brutas"("xidTransacao", "id");

-- CreateIndex
CREATE INDEX "leituras_brutas_recebidoEm_id_idx" ON "leituras_brutas"("recebidoEm", "id");

-- CreateIndex
CREATE INDEX "leituras_erro_leituraBrutaId_idx" ON "leituras_erro"("leituraBrutaId");

-- CreateIndex
CREATE INDEX "leituras_erro_vidEstacao_registradoEm_idx" ON "leituras_erro"("vidEstacao", "registradoEm");

-- CreateIndex
CREATE INDEX "leituras_erro_licitacaoId_registradoEm_idx" ON "leituras_erro"("licitacaoId", "registradoEm");

-- CreateIndex
CREATE INDEX "logs_auditoria_usuarioId_criadoEm_idx" ON "logs_auditoria"("usuarioId", "criadoEm");

-- CreateIndex
CREATE INDEX "logs_auditoria_entidade_entidadeId_idx" ON "logs_auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "logs_auditoria_licitacaoId_criadoEm_idx" ON "logs_auditoria"("licitacaoId", "criadoEm");

-- CreateIndex
CREATE INDEX "logs_auditoria_criadoEm_id_idx" ON "logs_auditoria"("criadoEm", "id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estacoes" ADD CONSTRAINT "estacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estacoes" ADD CONSTRAINT "estacoes_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_parametro" ADD CONSTRAINT "tipos_parametro_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_estacaoId_fkey" FOREIGN KEY ("estacaoId") REFERENCES "estacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametros" ADD CONSTRAINT "parametros_tipoParametroId_fkey" FOREIGN KEY ("tipoParametroId") REFERENCES "tipos_parametro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "parametros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_estacaoId_fkey" FOREIGN KEY ("estacaoId") REFERENCES "estacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medidas" ADD CONSTRAINT "medidas_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_parametroId_fkey" FOREIGN KEY ("parametroId") REFERENCES "parametros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_alertaId_fkey" FOREIGN KEY ("alertaId") REFERENCES "alertas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_medidaId_fkey" FOREIGN KEY ("medidaId") REFERENCES "medidas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_reconhecidoPorId_fkey" FOREIGN KEY ("reconhecidoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarmes" ADD CONSTRAINT "alarmes_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_licitacaoId_fkey" FOREIGN KEY ("licitacaoId") REFERENCES "licitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Parte 2: SQL manual (o Prisma não representa)
-- ============================================================================

-- Usuário TECSUS não tem licitação; os demais têm exatamente uma.
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_licitacao_conforme_tipo"
    CHECK ((tipo = 'ADMIN_TECSUS'::"TipoUsuario") = ("licitacaoId" IS NULL));

-- Funções: imutabilidade de dados originais e auditoria, trigger de alertas em
-- lote (trg_avaliar_alertas_lote), aviso ao tratamento e coerência de licitação.
CREATE FUNCTION public.avaliar_alertas_lote() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;

CREATE FUNCTION public.avisar_leituras_brutas_novas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM pg_notify('leituras_brutas_novas', '');
    RETURN NULL;
END;
$$;

CREATE FUNCTION public.impedir_alteracao_leituras_brutas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Leituras brutas são imutáveis';
END;
$$;

CREATE FUNCTION public.impedir_alteracao_leituras_erro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Leituras com erro são imutáveis';
END;
$$;

CREATE FUNCTION public.impedir_alteracao_logs_auditoria() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Registros de auditoria são imutáveis';
END;
$$;

CREATE FUNCTION public.impedir_alteracao_medidas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Medidas são imutáveis';
END;
$$;

CREATE FUNCTION public.verificar_licitacao_alerta() RETURNS trigger
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

CREATE FUNCTION public.verificar_licitacao_estacao() RETURNS trigger
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

CREATE FUNCTION public.verificar_licitacao_parametro() RETURNS trigger
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

CREATE FUNCTION public.verificar_licitacao_tipo_parametro() RETURNS trigger
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

-- Triggers
CREATE CONSTRAINT TRIGGER alertas_mesma_licitacao AFTER INSERT OR UPDATE ON public.alertas DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verificar_licitacao_alerta();
CREATE CONSTRAINT TRIGGER estacoes_mesma_licitacao AFTER UPDATE OF "licitacaoId" ON public.estacoes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verificar_licitacao_estacao();
CREATE TRIGGER leituras_brutas_avisar_novas AFTER INSERT ON public.leituras_brutas FOR EACH STATEMENT EXECUTE FUNCTION public.avisar_leituras_brutas_novas();
CREATE TRIGGER leituras_brutas_sem_truncate BEFORE TRUNCATE ON public.leituras_brutas FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_alteracao_leituras_brutas();
CREATE TRIGGER leituras_brutas_somente_insert BEFORE DELETE OR UPDATE ON public.leituras_brutas FOR EACH ROW EXECUTE FUNCTION public.impedir_alteracao_leituras_brutas();
CREATE TRIGGER leituras_erro_sem_truncate BEFORE TRUNCATE ON public.leituras_erro FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_alteracao_leituras_erro();
CREATE TRIGGER leituras_erro_somente_insert BEFORE DELETE OR UPDATE ON public.leituras_erro FOR EACH ROW EXECUTE FUNCTION public.impedir_alteracao_leituras_erro();
CREATE TRIGGER logs_auditoria_sem_truncate BEFORE TRUNCATE ON public.logs_auditoria FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_alteracao_logs_auditoria();
CREATE TRIGGER logs_auditoria_somente_insert BEFORE DELETE OR UPDATE ON public.logs_auditoria FOR EACH ROW EXECUTE FUNCTION public.impedir_alteracao_logs_auditoria();
CREATE TRIGGER medidas_sem_truncate BEFORE TRUNCATE ON public.medidas FOR EACH STATEMENT EXECUTE FUNCTION public.impedir_alteracao_medidas();
CREATE TRIGGER medidas_somente_insert BEFORE DELETE OR UPDATE ON public.medidas FOR EACH ROW EXECUTE FUNCTION public.impedir_alteracao_medidas();
CREATE CONSTRAINT TRIGGER parametros_mesma_licitacao AFTER INSERT OR UPDATE ON public.parametros DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verificar_licitacao_parametro();
CREATE CONSTRAINT TRIGGER tipos_parametro_mesma_licitacao AFTER UPDATE OF "licitacaoId" ON public.tipos_parametro DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.verificar_licitacao_tipo_parametro();
CREATE TRIGGER trg_avaliar_alertas_lote AFTER INSERT ON public.medidas REFERENCING NEW TABLE AS novas FOR EACH STATEMENT EXECUTE FUNCTION public.avaliar_alertas_lote();

-- Marcador do serviço de tratamento: começa depois de qualquer leitura bruta
-- que já exista (xid desta migration e acima de qualquer uuid).
INSERT INTO "controle_tratamento" ("id", "ultimoXid", "ultimaLeituraId")
VALUES ('leituras_brutas', ((pg_current_xact_id())::text)::bigint, 'ffffffff-ffff-ffff-ffff-ffffffffffff');
