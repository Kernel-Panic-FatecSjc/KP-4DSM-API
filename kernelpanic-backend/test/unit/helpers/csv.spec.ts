import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { BadRequestException } from '@nestjs/common';
import { enviarCsv, exigirPeriodo, linhaCsv, valorCsv } from '../../../src/exportacao/csv';

describe('CSV da exportação', () => {
  it('usa ";" e CRLF e escapa aspas, separador e quebra de linha', () => {
    expect(linhaCsv(['a', 1, null, 'x;y', 'diz "oi"', 'l1\nl2'])).toBe('a;1;;"x;y";"diz ""oi""";"l1\nl2"\r\n');
  });

  it('impede fórmula na planilha e serializa data e objeto', () => {
    expect(valorCsv('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(valorCsv(-5)).toBe('-5');
    expect(valorCsv(new Date('2026-10-24T12:00:00.000Z'))).toBe('2026-10-24T12:00:00.000Z');
    expect(valorCsv({ a: 1 })).toBe('"{""a"":1}"');
  });

  it('exige período completo e em ordem', () => {
    expect(() => exigirPeriodo(undefined, '2026-10-24')).toThrow(BadRequestException);
    expect(() => exigirPeriodo('2026-10-25', '2026-10-24')).toThrow(BadRequestException);
    expect(exigirPeriodo('2026-10-24', '2026-10-25').de).toEqual(new Date('2026-10-24'));
  });

  it('escreve BOM e cabeçalho, um lote por vez, e espera o drain quando o buffer enche', async () => {
    const escritos: string[] = [];
    let cheio = true;
    const resposta = Object.assign(new EventEmitter(), {
      destroyed: false,
      setHeader: jest.fn(),
      end: jest.fn(),
      write: (conteudo: string) => {
        escritos.push(conteudo);
        if (cheio) {
          cheio = false;
          setImmediate(() => resposta.emit('drain'));
          return false;
        }
        return true;
      },
    }) as unknown as Response;

    async function* lotes() {
      yield [['1', 'a']];
      yield [['2', 'b']];
    }
    await enviarCsv(resposta, 'x.csv', ['id', 'nome'], lotes());

    expect(escritos).toEqual(['﻿id;nome\r\n', '1;a\r\n', '2;b\r\n']);
    expect(resposta.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(resposta.end).toHaveBeenCalled();
  });
});
