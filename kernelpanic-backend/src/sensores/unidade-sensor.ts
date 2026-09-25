// Catálogo fechado de unidades aceitas no cadastro de sensores.
//
// Fica na aplicação, e não como enum do Prisma, por causa do RF01 (modelo
// dinâmico): a coluna tipos_parametro.unidade continua texto livre, então
// incluir uma unidade nova é só acrescentá-la aqui, sem migration.
export enum UnidadeSensor {
  MILIMETRO = 'mm',
  MILIMETRO_POR_HORA = 'mm/h',
  GRAU_CELSIUS = '°C',
  PERCENTUAL = '%',
  HECTOPASCAL = 'hPa',
  METRO_POR_SEGUNDO = 'm/s',
  QUILOMETRO_POR_HORA = 'km/h',
  GRAU = '°',
  WATT_POR_METRO_QUADRADO = 'W/m²',
  METRO = 'm',
  CENTIMETRO = 'cm',
  VOLT = 'V',
}

export interface DescricaoUnidade {
  valor: UnidadeSensor;
  nome: string;
  grandeza: string;
}

// A ordem aqui é a ordem em que o front apresenta as opções.
export const CATALOGO_UNIDADES: DescricaoUnidade[] = [
  { valor: UnidadeSensor.MILIMETRO, nome: 'Milímetro', grandeza: 'Precipitação' },
  { valor: UnidadeSensor.MILIMETRO_POR_HORA, nome: 'Milímetro por hora', grandeza: 'Precipitação' },
  { valor: UnidadeSensor.GRAU_CELSIUS, nome: 'Grau Celsius', grandeza: 'Temperatura' },
  { valor: UnidadeSensor.PERCENTUAL, nome: 'Percentual', grandeza: 'Umidade' },
  { valor: UnidadeSensor.HECTOPASCAL, nome: 'Hectopascal', grandeza: 'Pressão atmosférica' },
  { valor: UnidadeSensor.METRO_POR_SEGUNDO, nome: 'Metro por segundo', grandeza: 'Vento' },
  { valor: UnidadeSensor.QUILOMETRO_POR_HORA, nome: 'Quilômetro por hora', grandeza: 'Vento' },
  { valor: UnidadeSensor.GRAU, nome: 'Grau (direção)', grandeza: 'Vento' },
  { valor: UnidadeSensor.WATT_POR_METRO_QUADRADO, nome: 'Watt por metro quadrado', grandeza: 'Radiação solar' },
  { valor: UnidadeSensor.METRO, nome: 'Metro', grandeza: 'Nível d’água' },
  { valor: UnidadeSensor.CENTIMETRO, nome: 'Centímetro', grandeza: 'Nível d’água' },
  { valor: UnidadeSensor.VOLT, nome: 'Volt', grandeza: 'Energia' },
];
