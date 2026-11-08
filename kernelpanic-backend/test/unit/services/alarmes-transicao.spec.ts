import { dadosDaTransicao } from '../../../src/alarmes/alarmes.service';

const AGORA = new Date('2026-11-08T12:00:00.000Z');
const USUARIO = 'usuario-1';

describe('dadosDaTransicao (ações do alarme)', () => {
  it('reconhecer grava quem e quando reconheceu, sem resolução', () => {
    expect(dadosDaTransicao('ABERTO', { status: 'RECONHECIDO' }, USUARIO, AGORA)).toEqual({
      status: 'RECONHECIDO',
      reconhecidoEm: AGORA,
      reconhecidoPorId: USUARIO,
    });
  });

  it('resolver um alarme reconhecido grava só a resolução, sem sobrescrever o reconhecimento', () => {
    expect(dadosDaTransicao('RECONHECIDO', { status: 'RESOLVIDO' }, USUARIO, AGORA)).toEqual({
      status: 'RESOLVIDO',
      resolvidoEm: AGORA,
      resolvidoPorId: USUARIO,
    });
  });

  it('resolver direto um alarme aberto também registra o reconhecimento', () => {
    expect(dadosDaTransicao('ABERTO', { status: 'RESOLVIDO' }, USUARIO, AGORA)).toEqual({
      status: 'RESOLVIDO',
      reconhecidoEm: AGORA,
      reconhecidoPorId: USUARIO,
      resolvidoEm: AGORA,
      resolvidoPorId: USUARIO,
    });
  });

  it('grava a observação sem os espaços das pontas e ignora observação em branco', () => {
    expect(
      dadosDaTransicao('ABERTO', { status: 'RECONHECIDO', observacao: '  equipe enviada  ' }, USUARIO, AGORA),
    ).toMatchObject({ observacao: 'equipe enviada' });
    expect(dadosDaTransicao('ABERTO', { status: 'RECONHECIDO', observacao: '   ' }, USUARIO, AGORA)).not.toHaveProperty(
      'observacao',
    );
  });
});
