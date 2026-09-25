import type { Prisma } from '../../../src/generated/prisma/client';
import { AuditoriaRespostaDto } from '../../../src/auditoria/dto/auditoria-resposta.dto';

function resposta(enderecoIp: string | null): AuditoriaRespostaDto {
  const registro = {
    id: 'registro-1',
    criadoEm: new Date('2026-09-25T12:00:00.000Z'),
    acao: 'acesso.http',
    entidade: '/autenticacao/perfil',
    entidadeId: null,
    detalhes: { status: 401, email: 'privado@example.com', senha: 'segredo' },
    enderecoIp,
    usuario: null,
  } satisfies Pick<Prisma.LogAuditoriaModel, 'id' | 'criadoEm' | 'acao' | 'entidade' | 'entidadeId' | 'detalhes' | 'enderecoIp'> & {
    usuario: null;
  };

  return new AuditoriaRespostaDto(registro);
}

describe('AuditoriaRespostaDto', () => {
  it('mascara os dois últimos octetos IPv4 e remove dados sensíveis', () => {
    const dto = resposta('192.168.12.34');

    expect(dto.enderecoIp).toBe('192.168.*.*');
    expect(dto.detalhes).toMatchObject({ 'IP de origem (mascarado)': '192.168.*.*', status: 401 });
    expect(dto.detalhes).not.toHaveProperty('email');
    expect(dto.detalhes).not.toHaveProperty('senha');
  });

  it('mascara segmentos IPv6 e trata IP ausente', () => {
    expect(resposta('2001:db8:85a3::8a2e:370:7334').enderecoIp).toBe('2001:db8:85a3:*');
    expect(resposta(null).enderecoIp).toBeNull();
  });
});