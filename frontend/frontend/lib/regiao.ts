/** Mesmo raio usado pela API (RAIO_REGIAO_KM). */
export const RAIO_REGIAO_KM = 100;

export interface Regiao {
  latitude: number;
  longitude: number;
  descricao: string;
}

/**
 * Alternativa para quem não libera a localização: o visitante escolhe o estado
 * e usamos as coordenadas da capital como centro do raio.
 */
export const CAPITAIS_POR_UF: Record<string, { nome: string; capital: string; latitude: number; longitude: number }> = {
  AC: { nome: 'Acre', capital: 'Rio Branco', latitude: -9.9747, longitude: -67.8243 },
  AL: { nome: 'Alagoas', capital: 'Maceió', latitude: -9.6658, longitude: -35.7353 },
  AP: { nome: 'Amapá', capital: 'Macapá', latitude: 0.0349, longitude: -51.0694 },
  AM: { nome: 'Amazonas', capital: 'Manaus', latitude: -3.119, longitude: -60.0217 },
  BA: { nome: 'Bahia', capital: 'Salvador', latitude: -12.9714, longitude: -38.5014 },
  CE: { nome: 'Ceará', capital: 'Fortaleza', latitude: -3.7319, longitude: -38.5267 },
  DF: { nome: 'Distrito Federal', capital: 'Brasília', latitude: -15.7939, longitude: -47.8828 },
  ES: { nome: 'Espírito Santo', capital: 'Vitória', latitude: -20.3155, longitude: -40.3128 },
  GO: { nome: 'Goiás', capital: 'Goiânia', latitude: -16.6869, longitude: -49.2648 },
  MA: { nome: 'Maranhão', capital: 'São Luís', latitude: -2.5307, longitude: -44.3068 },
  MT: { nome: 'Mato Grosso', capital: 'Cuiabá', latitude: -15.6014, longitude: -56.0979 },
  MS: { nome: 'Mato Grosso do Sul', capital: 'Campo Grande', latitude: -20.4697, longitude: -54.6201 },
  MG: { nome: 'Minas Gerais', capital: 'Belo Horizonte', latitude: -19.9167, longitude: -43.9345 },
  PA: { nome: 'Pará', capital: 'Belém', latitude: -1.4558, longitude: -48.4902 },
  PB: { nome: 'Paraíba', capital: 'João Pessoa', latitude: -7.1195, longitude: -34.845 },
  PR: { nome: 'Paraná', capital: 'Curitiba', latitude: -25.4284, longitude: -49.2733 },
  PE: { nome: 'Pernambuco', capital: 'Recife', latitude: -8.0476, longitude: -34.877 },
  PI: { nome: 'Piauí', capital: 'Teresina', latitude: -5.0892, longitude: -42.8019 },
  RJ: { nome: 'Rio de Janeiro', capital: 'Rio de Janeiro', latitude: -22.9068, longitude: -43.1729 },
  RN: { nome: 'Rio Grande do Norte', capital: 'Natal', latitude: -5.7945, longitude: -35.211 },
  RS: { nome: 'Rio Grande do Sul', capital: 'Porto Alegre', latitude: -30.0346, longitude: -51.2177 },
  RO: { nome: 'Rondônia', capital: 'Porto Velho', latitude: -8.7612, longitude: -63.9004 },
  RR: { nome: 'Roraima', capital: 'Boa Vista', latitude: 2.8235, longitude: -60.6758 },
  SC: { nome: 'Santa Catarina', capital: 'Florianópolis', latitude: -27.5954, longitude: -48.548 },
  SP: { nome: 'São Paulo', capital: 'São Paulo', latitude: -23.5505, longitude: -46.6333 },
  SE: { nome: 'Sergipe', capital: 'Aracaju', latitude: -10.9472, longitude: -37.0731 },
  TO: { nome: 'Tocantins', capital: 'Palmas', latitude: -10.184, longitude: -48.3336 },
};

export function regiaoDaUf(uf: string): Regiao | null {
  const estado = CAPITAIS_POR_UF[uf];
  if (!estado) return null;
  return {
    latitude: estado.latitude,
    longitude: estado.longitude,
    descricao: `${estado.capital} (${uf})`,
  };
}

/** Parâmetros de query para a API filtrar pela região (vazio quando não há região). */
export function queryRegiao(regiao: Regiao | null): string {
  if (!regiao) return '';
  return new URLSearchParams({
    latitude: String(regiao.latitude),
    longitude: String(regiao.longitude),
  }).toString();
}
