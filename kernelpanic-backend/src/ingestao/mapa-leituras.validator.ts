import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

export const MAXIMO_SENSORES_POR_LEITURA = 50;

const PADRAO_NOME_SENSOR = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

export function ehMapaDeLeituras(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;

  const entradas = Object.entries(valor);
  if (entradas.length === 0 || entradas.length > MAXIMO_SENSORES_POR_LEITURA) return false;

  return entradas.every(
    ([nome, leitura]) =>
      PADRAO_NOME_SENSOR.test(nome) && typeof leitura === 'number' && Number.isFinite(leitura),
  );
}

export function EhMapaDeLeituras(options?: ValidationOptions) {
  return function (objeto: object, propriedade: string) {
    registerDecorator({
      name: 'ehMapaDeLeituras',
      target: objeto.constructor,
      propertyName: propriedade,
      options,
      validator: {
        validate: (valor: unknown) => ehMapaDeLeituras(valor),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} deve ser um objeto de 1 a ${MAXIMO_SENSORES_POR_LEITURA} pares "nomeDoSensor": número`,
      },
    });
  };
}
