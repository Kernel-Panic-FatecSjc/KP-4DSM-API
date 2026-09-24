// Com target ES2023, todo campo declarado no DTO vira propriedade própria da
// instância criada pelo ValidationPipe, valendo undefined quando não veio na
// requisição. Object.keys(dto) listaria todos; aqui ficam só os enviados.
export function camposInformados(dto: object): string[] {
  return Object.entries(dto)
    .filter(([, valor]) => valor !== undefined)
    .map(([campo]) => campo);
}
