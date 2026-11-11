import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

export const MAXIMO_SENSORES_POR_LEITURA = 50;

/**
 * O nome do sensor no payload é o "nome" do tipo de parâmetro cadastrado na
 * licitação, que o tratamento usa para achar o parâmetro. Aceita o mesmo que o
 * cadastro (src/sensores/dto/criar-sensor.dto.ts): até 120 caracteres, sem
 * espaço nas pontas, com acento e espaço no meio ("Pluviômetro", "Chuva
 * acumulada"). Antes só valia [a-zA-Z0-9_], e o pacote inteiro de uma estação
 * com sensor de nome acentuado era recusado.
 */
export const TAMANHO_MAXIMO_NOME_SENSOR = 120;
const PADRAO_NOME_SENSOR = new RegExp(`^(?=\\S)[^\\p{Cc}]{1,${TAMANHO_MAXIMO_NOME_SENSOR}}(?<=\\S)$`, 'u');
// Chaves que mexeriam no protótipo do objeto ao serem copiadas.
const NOMES_RESERVADOS = new Set(['__proto__', 'constructor', 'prototype']);

export function ehNomeDeSensor(nome: string): boolean {
  return PADRAO_NOME_SENSOR.test(nome) && !NOMES_RESERVADOS.has(nome);
}

export function ehMapaDeLeituras(valor: unknown): boolean {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;

  const entradas = Object.entries(valor);
  if (entradas.length === 0 || entradas.length > MAXIMO_SENSORES_POR_LEITURA) return false;

  return entradas.every(
    ([nome, leitura]) =>
      ehNomeDeSensor(nome) && typeof leitura === 'number' && Number.isFinite(leitura),
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
          `${args.property} deve ser um objeto de 1 a ${MAXIMO_SENSORES_POR_LEITURA} pares "nomeDoSensor": número (nome com até ${TAMANHO_MAXIMO_NOME_SENSOR} caracteres, sem espaço nas pontas)`,
      },
    });
  };
}
