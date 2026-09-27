import { BadRequestException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, ValidateIf } from 'class-validator';

/** Raio fixo em torno do visitante: ele só enxerga estações dentro dele. */
export const RAIO_REGIAO_KM = 100;

// Raio médio da Terra (o mesmo da esfera usada pelo PostGIS com
// use_spheroid = false), para a conta em memória bater com a do banco.
const RAIO_TERRA_KM = 6371.0087714;

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

/**
 * Localização opcional de quem consulta. Latitude e longitude andam juntas:
 * informar só uma das duas é erro de validação.
 */
export class RegiaoQueryDto {
  @ValidateIf((dto: RegiaoQueryDto) => dto.longitude !== undefined)
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ValidateIf((dto: RegiaoQueryDto) => dto.latitude !== undefined)
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}

export function extrairRegiao(query: RegiaoQueryDto): Coordenadas | undefined {
  if (query.latitude === undefined || query.longitude === undefined) return undefined;
  return { latitude: query.latitude, longitude: query.longitude };
}

/**
 * Visitante (sem login) só consulta alertas perto dele; quem está logado vê
 * tudo e pode, opcionalmente, filtrar por região também.
 */
export function resolverRegiao(query: RegiaoQueryDto, autenticado: boolean): Coordenadas | undefined {
  const regiao = extrairRegiao(query);
  if (!regiao && !autenticado) {
    throw new BadRequestException('Informe latitude e longitude para consultar os alertas da sua região');
  }
  return regiao;
}

export function distanciaKm(origem: Coordenadas, destino: Coordenadas): number {
  const radianos = (graus: number) => (graus * Math.PI) / 180;
  const dLat = radianos(destino.latitude - origem.latitude);
  const dLon = radianos(destino.longitude - origem.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radianos(origem.latitude)) * Math.cos(radianos(destino.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(a));
}

export function coordenadasValidas(valor: unknown): valor is Coordenadas {
  if (typeof valor !== 'object' || valor === null) return false;
  const { latitude, longitude } = valor as Record<string, unknown>;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}
