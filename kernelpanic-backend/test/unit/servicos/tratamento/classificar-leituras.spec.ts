import {
  classificarLeitura,
  type EstacaoParaTratamento,
  type LeituraBrutaParaTratar,
} from '../../../../servicos/tratamento/classificar-leituras';

const LICITACAO = 'licitacao-a';
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const estacao = (
  valorMinimo: number | null = null,
  valorMaximo: number | null = null,
  statusOperacional: 'ATIVA' | 'INATIVA' = 'ATIVA',
): EstacaoParaTratamento => ({
  id: 'estacao-1',
  licitacaoId: LICITACAO,
  statusOperacional,
  parametros: [{ id: 'parametro-temp', tipoParametro: { nome: 'temperatura', valorMinimo, valorMaximo } }],
});

const leitura = (payload: Record<string, unknown>): LeituraBrutaParaTratar => ({
  id: 'bruta-1',
  vidEstacao: 'ESP32-00001',
  payload,
  unixtimeDispositivo: 1_760_000_000n,
});

describe('classificarLeitura (tratamento)', () => {
  it('vira medida o sensor configurado, com a licitação da estação e o unixtime do dispositivo', () => {
    const { medidas, erros } = classificarLeitura(leitura({ temperatura: 25 }), estacao());

    expect(medidas).toEqual([
      { parametroId: 'parametro-temp', estacaoId: 'estacao-1', licitacaoId: LICITACAO, valor: 25, unixtime: 1_760_000_000n },
    ]);
    expect(erros).toEqual([]);
  });

  it('aceita o valor igual a cada limite da faixa', () => {
    expect(classificarLeitura(leitura({ temperatura: -40 }), estacao(-40, 60)).medidas).toHaveLength(1);
    expect(classificarLeitura(leitura({ temperatura: 60 }), estacao(-40, 60)).medidas).toHaveLength(1);
  });

  it.each([
    [150, 'ACIMA_DO_MAXIMO'],
    [-40.5, 'ABAIXO_DO_MINIMO'],
  ])('manda %s para leituras_erro como %s, sem medida', (valor, motivo) => {
    const { medidas, erros } = classificarLeitura(leitura({ temperatura: valor }), estacao(-40, 60));

    expect(medidas).toEqual([]);
    expect(erros).toEqual([
      {
        id: expect.stringMatching(REGEX_UUID),
        leituraBrutaId: 'bruta-1',
        vidEstacao: 'ESP32-00001',
        nomeSensor: 'temperatura',
        parametroId: 'parametro-temp',
        licitacaoId: LICITACAO,
        valor,
        unixtime: 1_760_000_000n,
        motivo,
        valorMinimo: -40,
        valorMaximo: 60,
      },
    ]);
  });

  it('descarta só a leitura fora da faixa e segue com as outras do mesmo pacote', () => {
    const { medidas, erros } = classificarLeitura(leitura({ temperatura: 25, sensorDesconhecido: 7 }), estacao());

    expect(medidas).toHaveLength(1);
    expect(erros).toEqual([
      expect.objectContaining({ nomeSensor: 'sensorDesconhecido', parametroId: null, motivo: 'SENSOR_NAO_CONFIGURADO' }),
    ]);
  });

  it('não checa faixa quando o tipo não tem limites', () => {
    expect(classificarLeitura(leitura({ temperatura: 1e6 }), estacao()).medidas).toHaveLength(1);
  });

  it('estação inativa: nada vira medida nem leitura com erro (o pacote fica só em leituras_brutas)', () => {
    expect(classificarLeitura(leitura({ temperatura: 25 }), estacao(null, null, 'INATIVA'))).toEqual({
      medidas: [],
      erros: [],
    });
  });

  it('vid sem estação: registra cada leitura como ESTACAO_NAO_CADASTRADA, sem licitação', () => {
    const { medidas, erros } = classificarLeitura(leitura({ temperatura: 25 }), undefined);

    expect(medidas).toEqual([]);
    expect(erros).toEqual([expect.objectContaining({ motivo: 'ESTACAO_NAO_CADASTRADA', licitacaoId: null })]);
  });

  it('ignora valor que não é número (o formato é conferido na ingestão)', () => {
    expect(classificarLeitura(leitura({ temperatura: 'x', umidade: null }), estacao())).toEqual({ medidas: [], erros: [] });
  });

  it('dá a cada leitura com erro um id próprio', () => {
    const { erros } = classificarLeitura(leitura({ a: 1, b: 2 }), estacao());
    expect(new Set(erros.map((erro) => erro.id)).size).toBe(2);
  });
});
