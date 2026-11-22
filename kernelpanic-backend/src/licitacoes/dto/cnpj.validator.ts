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
          if (!/^[\dA-Za-z./\-\s]+$/.test(value)) return false;
          const cnpj = value.replace(/[^0-9A-Z]/gi, '').toUpperCase();
          if (
            cnpj.length !== 14 ||
            !/^[0-9A-Z]{12}\d{2}$/.test(cnpj) ||
            /^([0-9A-Z])\1{13}$/.test(cnpj)
          ) {
            return false;
          }
          const calcularDigito = (base: string, pesos: number[]) => {
            const resto = [...base].reduce(
              (soma, caractere, indice) =>
                soma + (caractere.charCodeAt(0) - 48) * pesos[indice],
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
