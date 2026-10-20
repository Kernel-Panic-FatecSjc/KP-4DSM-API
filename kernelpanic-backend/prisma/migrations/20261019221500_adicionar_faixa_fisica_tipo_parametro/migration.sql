-- Faixa física válida (inclusiva e opcional) de cada tipo de parâmetro: a
-- ingestão não grava medida fora dela e registra a leitura em leituras_erro.
-- Nulo em um dos lados deixa aquele limite sem checagem.
ALTER TABLE "tipos_parametro" ADD COLUMN     "valorMaximo" DOUBLE PRECISION,
ADD COLUMN     "valorMinimo" DOUBLE PRECISION;
