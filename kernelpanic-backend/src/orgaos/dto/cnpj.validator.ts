import { registerDecorator, ValidationOptions } from 'class-validator';

export function IsCnpj(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isCnpj',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          if (!/^[\d./\-\s]+$/.test(value)) return false;
          const cnpj = value.replace(/\D/g, '');
          if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
          const calcularDigito = (base: string, pesos: number[]) => {
            const resto =
              base
                .split('')
                .reduce(
                  (soma, digito, indice) =>
                    soma + Number(digito) * pesos[indice],
                  0,
                ) % 11;
            return resto < 2 ? 0 : 11 - resto;
          };
          const primeiro = calcularDigito(
            cnpj.slice(0, 12),
            [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
          );
          const segundo = calcularDigito(
            cnpj.slice(0, 12) + primeiro,
            [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
          );
          return cnpj.endsWith(`${primeiro}${segundo}`);
        },
      },
    });
  };
}
