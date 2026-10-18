import {
  calcularHashChaveIngestao,
  chaveIngestaoConfere,
  gerarChaveIngestao,
} from '../../../src/ingestao/chave-ingestao';

describe('chave de ingestão', () => {
  it('gera chaves diferentes e guarda só o hash', () => {
    const primeira = gerarChaveIngestao();
    const segunda = gerarChaveIngestao();

    expect(primeira.chave).not.toBe(segunda.chave);
    expect(primeira.hash).toBe(calcularHashChaveIngestao(primeira.chave));
    expect(primeira.hash).not.toContain(primeira.chave);
  });

  it('confere a chave contra o hash', () => {
    const { chave, hash } = gerarChaveIngestao();

    expect(chaveIngestaoConfere(chave, hash)).toBe(true);
    expect(chaveIngestaoConfere(`${chave}x`, hash)).toBe(false);
    expect(chaveIngestaoConfere(chave, 'hash-malformado')).toBe(false);
  });
});
