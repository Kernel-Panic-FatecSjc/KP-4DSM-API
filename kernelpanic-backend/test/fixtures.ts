export const VID_ESTACAO = 'ESP32-00001';

export const LEITURAS = {
  temperatura: 24.3,
  umidade: 61.2,
  chuvaMm: 0.4,
};

export const ESTACAO_COM_COORDENADAS = {
  id: 'estacao-1',
  latitude: -23.1,
  longitude: -45.8,
};

export const TIPO_CHUVA = '11111111-1111-4111-8111-111111111111';

export const TIPO_TEMPERATURA = '33333333-3333-4333-8333-333333333333';

export const ESTACAO_COM_TIPOS = {
  id: 'estacao-1',
  vid: VID_ESTACAO,
  nome: 'Estação Centro',
  parametros: [
    {
      tipoParametro: {
        id: TIPO_CHUVA,
        nome: 'Pluviômetro',
        unidade: 'mm',
        fator: 1,
        ganho: 0.2,
      },
    },
  ],
};

export const PARAMETRO_CHUVA = '22222222-2222-4222-8222-222222222222';

export const NOVO_ALERTA = {
  operador: 'MAIOR_QUE',
  valorLimite: 30,
  severidade: 'EMERGENCIA',
  parametroId: PARAMETRO_CHUVA,
};

export const ALERTA_COM_RELACOES = {
  id: 'alerta-1',
  ...NOVO_ALERTA,
  ativo: true,
  criadoEm: new Date('2026-09-23T12:00:00.000Z'),
  parametro: {
    id: PARAMETRO_CHUVA,
    estacaoId: ESTACAO_COM_TIPOS.id,
    tipoParametroId: TIPO_CHUVA,
    estacao: { id: ESTACAO_COM_TIPOS.id, nome: ESTACAO_COM_TIPOS.nome },
    tipoParametro: ESTACAO_COM_TIPOS.parametros[0].tipoParametro,
  },
};

export const ESTACAO_COM_SENSORES = {
  id: 'estacao-1',
  nome: 'Estação Centro',
  endereco: 'Rua A, 100',
  vid: VID_ESTACAO,
  latitude: -23.1,
  longitude: -45.8,
  statusOperacional: 'ATIVA',
  criadoEm: new Date('2026-09-20T12:00:00.000Z'),
  atualizadoEm: new Date('2026-09-20T12:00:00.000Z'),
  parametros: [
    {
      id: 'parametro-chuva',
      tipoParametroId: TIPO_CHUVA,
      tipoParametro: ESTACAO_COM_TIPOS.parametros[0].tipoParametro,
    },
  ],
};
