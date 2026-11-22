import { describe, expect, it } from 'vitest';
import { calcularDigitoCnpj, cnpjValido, formatarCnpj, gerarCnpj, limparCnpj } from '@/lib/cnpj';

// 11.222.333/0001-81 é o CNPJ numérico de exemplo mais usado; 12.ABC.345/01DE-35
// é o exemplo alfanumérico publicado pela Receita.

describe('limparCnpj', () => {
  it('tira a máscara e deixa as letras em maiúsculas', () => {
    expect(limparCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(limparCnpj(' 12.abc.345/01de-35 ')).toBe('12ABC34501DE35');
  });
});

describe('calcularDigitoCnpj', () => {
  it('calcula o primeiro dígito pela base e o segundo pela base com o primeiro', () => {
    expect(calcularDigitoCnpj('112223330001')).toBe('8');
    expect(calcularDigitoCnpj('1122233300018')).toBe('1');
  });

  it('dá valor às letras pelo código ASCII menos 48', () => {
    expect(calcularDigitoCnpj('12ABC34501DE')).toBe('3');
    expect(calcularDigitoCnpj('12ABC34501DE3')).toBe('5');
  });

  it('usa 0 quando o resto da divisão por 11 é menor que 2', () => {
    // Soma 3×3 + 1×2 = 11 (resto 0) e soma 4×3 = 12 (resto 1).
    expect(calcularDigitoCnpj('000000000031')).toBe('0');
    expect(calcularDigitoCnpj('000000000040')).toBe('0');
  });
});

describe('gerarCnpj', () => {
  it('completa a base com os dois dígitos verificadores', () => {
    expect(gerarCnpj('112223330001')).toBe('11222333000181');
    expect(gerarCnpj('12ABC34501DE')).toBe('12ABC34501DE35');
  });
});

describe('formatarCnpj', () => {
  it.each([
    ['11222333000181', '11.222.333/0001-81'],
    ['12abc34501de35', '12.ABC.345/01DE-35'],
    // Parcial, enquanto o usuário digita.
    ['11', '11'],
    ['11222', '11.222'],
    ['11222333', '11.222.333'],
    ['112223330001', '11.222.333/0001'],
    ['1122233300018', '11.222.333/0001-8'],
  ])('formata "%s" como "%s"', (valor, esperado) => {
    expect(formatarCnpj(valor)).toBe(esperado);
  });

  it('refaz a máscara de um valor já formatado ou colado com outros separadores', () => {
    expect(formatarCnpj('11.222.333/0001-81')).toBe('11.222.333/0001-81');
    expect(formatarCnpj('11 222 333 0001 81')).toBe('11.222.333/0001-81');
  });

  it('ignora o que passa dos 14 caracteres', () => {
    expect(formatarCnpj('1122233300018199')).toBe('11.222.333/0001-81');
  });
});

describe('cnpjValido', () => {
  it.each(['11.222.333/0001-81', '11222333000181', '12.ABC.345/01DE-35', '12abc34501de35'])(
    'aceita %s',
    (cnpj) => {
      expect(cnpjValido(cnpj)).toBe(true);
    },
  );

  it.each([
    ['dígito verificador errado', '11.222.333/0001-82'],
    ['dígito verificador alfanumérico errado', '12.ABC.345/01DE-36'],
    ['curto', '11.222.333/0001-8'],
    ['longo', '11.222.333/0001-810'],
    ['vazio', ''],
    ['letra no lugar do dígito verificador', '12.ABC.345/01DE-3A'],
    // Passa no cálculo, mas a Receita não emite.
    ['todos os caracteres iguais', '00.000.000/0000-00'],
  ])('recusa CNPJ com %s (%s)', (_, cnpj) => {
    expect(cnpjValido(cnpj)).toBe(false);
  });
});
