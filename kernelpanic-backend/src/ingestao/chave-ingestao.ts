import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface ChaveIngestaoGerada {
  chave: string;
  hash: string;
}

// A chave é aleatória (256 bits), então SHA-256 basta para guardá-la: não há
// senha fraca para proteger contra dicionário, e a rota de ingestão, de alta
// frequência, não pode pagar o custo de um bcrypt por requisição.
export function gerarChaveIngestao(): ChaveIngestaoGerada {
  const chave = randomBytes(32).toString('base64url');
  return { chave, hash: calcularHashChaveIngestao(chave) };
}

export function calcularHashChaveIngestao(chave: string): string {
  return createHash('sha256').update(chave).digest('hex');
}

export function chaveIngestaoConfere(chave: string, hash: string): boolean {
  const recebido = Buffer.from(calcularHashChaveIngestao(chave), 'hex');
  const esperado = Buffer.from(hash, 'hex');
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
