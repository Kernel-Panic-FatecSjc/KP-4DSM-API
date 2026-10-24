-- Novos usuários passam a nascer como MONITOR (menor privilégio) em vez de ADMINISTRADOR.
-- Usuários já existentes não são alterados; o seed define ADMINISTRADOR explicitamente.
ALTER TABLE "usuarios" ALTER COLUMN "tipo" SET DEFAULT 'MONITOR';
