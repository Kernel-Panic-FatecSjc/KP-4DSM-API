// CNPJ: 12 caracteres de base e 2 dígitos verificadores. Desde julho de 2026 a
// Receita também emite CNPJ com letras na base (IN RFB nº 2.229/2024); os
// verificadores continuam numéricos e o cálculo é o mesmo módulo 11, com cada
// caractere valendo o código ASCII menos 48 ('0'–'9' = 0–9, 'A'–'Z' = 17–42).

const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, ...PESOS_PRIMEIRO_DIGITO];

/** Tira a máscara e deixa as letras em maiúsculas, como o CNPJ é guardado. */
export function limparCnpj(valor: string): string {
  return valor.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Dígito verificador da base (12 caracteres) ou da base com o primeiro dígito (13). */
export function calcularDigitoCnpj(base: string): string {
  const pesos = base.length === 12 ? PESOS_PRIMEIRO_DIGITO : PESOS_SEGUNDO_DIGITO;
  const soma = [...base].reduce(
    (total, caractere, indice) => total + (caractere.charCodeAt(0) - 48) * pesos[indice],
    0,
  );
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

/** Completa a base de 12 caracteres com os dois dígitos verificadores. */
export function gerarCnpj(base: string): string {
  const primeiro = calcularDigitoCnpj(base);
  const segundo = calcularDigitoCnpj(`${base}${primeiro}`);
  return `${base}${primeiro}${segundo}`;
}

/** Máscara 00.000.000/0000-00, aplicada também enquanto o usuário digita. */
export function formatarCnpj(valor: string): string {
  return limparCnpj(valor)
    .slice(0, 14)
    .replace(/^(\w{2})(\w)/, '$1.$2')
    .replace(/^(\w{2})\.(\w{3})(\w)/, '$1.$2.$3')
    .replace(/\.(\w{3})(\w)/, '.$1/$2')
    .replace(/(\w{4})(\w)/, '$1-$2');
}

export function cnpjValido(valor: string): boolean {
  const cnpj = limparCnpj(valor);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  return cnpj === gerarCnpj(cnpj.slice(0, 12));
}
