import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { valorTrustProxy } from '../../../src/configurar-app';
import { criarAppDeTeste } from '../../helpers';

describe('valorTrustProxy', () => {
  it('vazio ou "false" não confia em proxy nenhum', () => {
    expect(valorTrustProxy(undefined)).toBeUndefined();
    expect(valorTrustProxy('')).toBeUndefined();
    expect(valorTrustProxy('false')).toBeUndefined();
  });

  it('número vira quantidade de saltos; o resto vai como lista do Express', () => {
    expect(valorTrustProxy('1')).toBe(1);
    expect(valorTrustProxy(' loopback, 10.0.0.0/8 ')).toBe('loopback, 10.0.0.0/8');
  });
});

describe('IP de origem na trilha de auditoria', () => {
  const logAuditoria = { create: jest.fn().mockResolvedValue({}) };
  const prismaMock = { usuario: { findUnique: jest.fn() }, logAuditoria, $connect: jest.fn(), $disconnect: jest.fn() };

  /** Tentativa negada (401) passando por um "proxy" que informa o cliente no X-Forwarded-For. */
  async function ipRegistrado(trustProxy: string | undefined): Promise<string> {
    const anterior = process.env.TRUST_PROXY;
    if (trustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = trustProxy;
    let app: INestApplication | undefined;
    try {
      app = await criarAppDeTeste({ prismaMock });
      logAuditoria.create.mockClear();
      await request(app.getHttpServer())
        .patch('/alarmes/qualquer')
        .set('X-Forwarded-For', '198.51.100.7')
        .send({ status: 'RECONHECIDO' })
        .expect(401);
      // O registro sai no 'finish' da resposta.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const registro = logAuditoria.create.mock.calls.map(([argumento]) => argumento.data).find((dados) => dados.acao === 'acesso.http');
      return registro.enderecoIp;
    } finally {
      await app?.close();
      if (anterior === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = anterior;
    }
  }

  it('com TRUST_PROXY, grava o IP do cliente informado pelo proxy', async () => {
    expect(await ipRegistrado('loopback')).toBe('198.51.100.7');
  }, 60_000);

  it('sem TRUST_PROXY, ignora o X-Forwarded-For (o cliente poderia forjá-lo)', async () => {
    expect(await ipRegistrado(undefined)).not.toBe('198.51.100.7');
  }, 60_000);
});
