import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

export const UNIXTIME_MINIMO = 1_000_000_000;

export const TOLERANCIA_FUTURO_SEGUNDOS = 300;

export function unixtimeEhPlausivel(valor: number, agora = Date.now()): boolean {
  if (!Number.isInteger(valor)) return false;

  const limiteSuperior = Math.floor(agora / 1000) + TOLERANCIA_FUTURO_SEGUNDOS;
  return valor >= UNIXTIME_MINIMO && valor <= limiteSuperior;
}

export function EhUnixtimePlausivel(options?: ValidationOptions) {
  return function (objeto: object, propriedade: string) {
    registerDecorator({
      name: 'ehUnixtimePlausivel',
      target: objeto.constructor,
      propertyName: propriedade,
      options,
      validator: {
        validate: (valor: unknown) => typeof valor === 'number' && unixtimeEhPlausivel(valor),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} deve ser um unixtime em segundos entre ${UNIXTIME_MINIMO} e o momento atual`,
      },
    });
  };
}
