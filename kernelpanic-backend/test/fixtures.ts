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
