import { agruparOcorrencias, valorPico, type AlarmeParaOcorrencia } from '../../../src/relatorios/ocorrencias';

const T0 = 1_762_600_000; // segundos
const MIN = 60;

const ALERTA_CHUVA = { id: 'alerta-chuva', operador: 'MAIOR_QUE' as const, valorLimite: 30, severidade: 'EMERGENCIA' as const };
const ALERTA_NIVEL = { id: 'alerta-nivel', operador: 'MAIOR_QUE' as const, valorLimite: 2, severidade: 'ALERTA' as const };

let sequencia = 0;
function alarme(minuto: number, valor: number, extra: Partial<AlarmeParaOcorrencia> = {}): AlarmeParaOcorrencia {
  sequencia += 1;
  return {
    id: `alarme-${String(sequencia).padStart(3, '0')}`,
    status: 'ABERTO',
    unixtime: T0 + minuto * MIN,
    valor,
    reconhecidoEm: null,
    reconhecidoPor: null,
    resolvidoEm: null,
    resolvidoPor: null,
    observacao: null,
    alerta: ALERTA_CHUVA,
    estacao: { id: 'estacao-1', nome: 'Centro' },
    parametro: { id: 'tipo-chuva', nome: 'Pluviômetro', unidade: 'mm' },
    ...extra,
  };
}

describe('agruparOcorrencias', () => {
  it('sequência contínua (a cada 5 min) vira uma ocorrência com início, fim, duração, pico e leituras', () => {
    const alarmes = [0, 5, 10, 15, 20].map((minuto, i) => alarme(minuto, [31, 35, 48, 40, 32][i]));

    const [ocorrencia, ...resto] = agruparOcorrencias(alarmes, 15);

    expect(resto).toHaveLength(0);
    expect(ocorrencia).toMatchObject({
      alertaId: ALERTA_CHUVA.id,
      inicio: new Date(T0 * 1000),
      fim: new Date((T0 + 20 * MIN) * 1000),
      duracaoSegundos: 20 * MIN,
      valorPico: 48,
      leituras: 5,
      status: 'ABERTO',
    });
  });

  it('intervalo menor ou igual à tolerância mantém a mesma ocorrência', () => {
    const alarmes = [alarme(0, 31), alarme(10, 33), alarme(25, 34)];

    expect(agruparOcorrencias(alarmes, 15)).toHaveLength(1);
  });

  it('intervalo maior que a tolerância abre uma nova ocorrência', () => {
    const alarmes = [alarme(0, 31), alarme(5, 33), alarme(40, 50), alarme(45, 36)];

    const ocorrencias = agruparOcorrencias(alarmes, 15);

    // Mais recente primeiro.
    expect(ocorrencias.map((o) => [o.leituras, o.duracaoSegundos, o.valorPico])).toEqual([
      [2, 5 * MIN, 50],
      [2, 5 * MIN, 33],
    ]);
  });

  it('a tolerância é configurável: a mesma sequência agrupa diferente', () => {
    const alarmes = [alarme(0, 31), alarme(20, 33), alarme(40, 35)];

    expect(agruparOcorrencias(alarmes, 15)).toHaveLength(3);
    expect(agruparOcorrencias(alarmes, 30)).toHaveLength(1);
  });

  it('não junta alertas diferentes, mesmo intercalados no tempo, e aceita entrada fora de ordem', () => {
    const nivel = { alerta: ALERTA_NIVEL, parametro: { id: 'tipo-nivel', nome: 'Nível', unidade: 'm' } };
    const alarmes = [alarme(10, 35), alarme(5, 2.5, nivel), alarme(0, 31), alarme(10, 2.8, nivel)];

    const ocorrencias = agruparOcorrencias(alarmes, 15);

    expect(ocorrencias).toHaveLength(2);
    expect(ocorrencias.find((o) => o.alertaId === ALERTA_NIVEL.id)).toMatchObject({ leituras: 2, valorPico: 2.8 });
    expect(ocorrencias.find((o) => o.alertaId === ALERTA_CHUVA.id)).toMatchObject({ leituras: 2, valorPico: 35 });
  });

  it('leitura única: duração zero', () => {
    expect(agruparOcorrencias([alarme(0, 31)])[0]).toMatchObject({ duracaoSegundos: 0, leituras: 1 });
  });

  it('ações: primeiro reconhecimento, última resolução só quando todos estão resolvidos, e observações sem repetir', () => {
    const ana = { id: 'u-ana', nome: 'Ana' };
    const bruno = { id: 'u-bruno', nome: 'Bruno' };
    const resolvido = (minuto: number, reconhecidoMin: number, resolvidoMin: number, por: typeof ana, observacao: string | null) =>
      alarme(minuto, 31, {
        status: 'RESOLVIDO',
        reconhecidoEm: new Date((T0 + reconhecidoMin * MIN) * 1000),
        reconhecidoPor: por,
        resolvidoEm: new Date((T0 + resolvidoMin * MIN) * 1000),
        resolvidoPor: por,
        observacao,
      });

    const [todas] = agruparOcorrencias([
      resolvido(0, 7, 60, bruno, 'Equipe enviada'),
      resolvido(5, 6, 90, ana, 'Equipe enviada'),
    ]);
    expect(todas.status).toBe('RESOLVIDO');
    expect(todas.reconhecimento).toEqual({ em: new Date((T0 + 6 * MIN) * 1000), por: ana });
    expect(todas.resolucao).toEqual({ em: new Date((T0 + 90 * MIN) * 1000), por: ana });
    expect(todas.observacoes).toEqual(['Equipe enviada']);

    const [parcial] = agruparOcorrencias([resolvido(0, 7, 60, bruno, null), alarme(5, 40)]);
    expect(parcial.status).toBe('ABERTO');
    expect(parcial.resolucao).toBeNull();
    expect(parcial.reconhecimento?.por).toEqual(bruno);
  });
});

describe('valorPico', () => {
  it('segue o sentido do operador', () => {
    expect(valorPico([31, 48, 35], 'MAIOR_QUE', 30)).toBe(48);
    expect(valorPico([9, 3, 7], 'MENOR_OU_IGUAL', 10)).toBe(3);
    expect(valorPico([12, 4, 11], 'DIFERENTE_DE', 10)).toBe(4);
  });
});
