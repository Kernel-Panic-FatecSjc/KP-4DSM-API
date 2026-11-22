import type { Page, Route } from '@playwright/test';
import { API_URL } from '@/lib/api';

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** "MÉTODO /caminho", com :parametros. Ex.: "PATCH /usuarios/:id/ativar". A query não entra. */
export type Rota = `${Metodo} /${string}`;

export interface RespostaFalsa {
  status?: number;
  body?: unknown;
}

export interface Chamada {
  rota: Rota;
  url: URL;
  params: Record<string, string>;
  corpo: unknown;
}

export type Manipulador = RespostaFalsa | ((chamada: Chamada) => RespostaFalsa);

interface RotaRegistrada {
  rota: Rota;
  metodo: string;
  padrao: RegExp;
  manipulador: Manipulador;
}

const PREFIXO_API = new URL(API_URL).pathname.replace(/\/$/, '');

function compilar(rota: Rota): Pick<RotaRegistrada, 'metodo' | 'padrao'> {
  const [metodo, caminho] = rota.split(' ');
  const padrao = caminho
    .split('/')
    .map((parte) => (parte.startsWith(':') ? `(?<${parte.slice(1)}>[^/]+)` : parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return { metodo, padrao: new RegExp(`^${padrao}$`) };
}

/**
 * Faz o papel da API nos testes funcionais: intercepta, no navegador, as
 * requisições para a API_URL e responde com o que o teste definiu.
 *
 * Rota chamada pela tela sem resposta definida recebe 501 e fica em
 * `naoRespondidas`; o fixture `api` (support/teste.ts) reprova o teste por isso.
 */
export class ApiFalsa {
  readonly chamadas: Chamada[] = [];
  readonly naoRespondidas: string[] = [];
  private readonly rotas: RotaRegistrada[] = [];

  /** Define a resposta de uma rota. Definir de novo a mesma rota substitui a anterior. */
  responder(rota: Rota, manipulador: Manipulador): this {
    this.rotas.unshift({ rota, manipulador, ...compilar(rota) });
    return this;
  }

  /** Chamadas feitas a uma rota, na ordem em que a tela fez. */
  chamadasDe(rota: Rota): Chamada[] {
    return this.chamadas.filter((chamada) => chamada.rota === rota);
  }

  async instalar(page: Page): Promise<void> {
    await page.route(`${API_URL}/**`, (route) => this.atender(route));
  }

  private async atender(route: Route): Promise<void> {
    const requisicao = route.request();
    const url = new URL(requisicao.url());
    const caminho = url.pathname.slice(PREFIXO_API.length) || '/';
    // A API fica em outra origem: sem estes cabeçalhos o navegador barra a
    // resposta (CORS). O preflight (OPTIONS) o próprio Playwright já responde.
    const cors = {
      'access-control-allow-origin': requisicao.headers()['origin'] ?? '*',
      'access-control-allow-credentials': 'true',
    };

    // Websocket de alarmes (socket.io): sem servidor nos testes, o cliente
    // só tenta reconectar. Teste de tempo real precisa de outra abordagem.
    if (caminho.startsWith('/socket.io/')) {
      await route.abort();
      return;
    }

    const registrada = this.rotas.find((rota) => rota.metodo === requisicao.method() && rota.padrao.test(caminho));
    if (!registrada) {
      const descricao = `${requisicao.method()} ${caminho}${url.search}`;
      this.naoRespondidas.push(descricao);
      await route.fulfill({
        status: 501,
        headers: cors,
        contentType: 'application/json',
        body: JSON.stringify({ message: `Rota sem resposta no teste: ${descricao}` }),
      });
      return;
    }

    let corpo: unknown = null;
    try {
      corpo = requisicao.postDataJSON();
    } catch {
      corpo = requisicao.postData();
    }

    const chamada: Chamada = {
      rota: registrada.rota,
      url,
      params: { ...registrada.padrao.exec(caminho)?.groups },
      corpo,
    };
    this.chamadas.push(chamada);

    const { status = 200, body = null } =
      typeof registrada.manipulador === 'function' ? registrada.manipulador(chamada) : registrada.manipulador;

    await route.fulfill({
      status,
      headers: cors,
      contentType: 'application/json',
      body: status === 204 ? '' : JSON.stringify(body),
    });
  }
}
