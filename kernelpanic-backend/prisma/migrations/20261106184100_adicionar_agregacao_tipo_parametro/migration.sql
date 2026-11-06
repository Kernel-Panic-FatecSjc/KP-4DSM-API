CREATE TYPE "AgregacaoParametro" AS ENUM ('SOMA', 'MEDIA');

ALTER TABLE "tipos_parametro"
ADD COLUMN "agregacao" "AgregacaoParametro" NOT NULL DEFAULT 'MEDIA';

-- The supported catalog uses mm only for accumulated precipitation.
UPDATE "tipos_parametro"
SET "agregacao" = 'SOMA'
WHERE "unidade" = 'mm';
