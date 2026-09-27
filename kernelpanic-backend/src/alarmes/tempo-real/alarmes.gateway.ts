import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { PayloadJwt } from '../../autenticacao/payload-jwt.interface';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { coordenadasValidas, distanciaKm, RAIO_REGIAO_KM, type Coordenadas } from '../../regiao/regiao';
import type { AlarmeHistoricoRespostaDto } from '../dto/alarme-historico-resposta.dto';

export const EVENTO_NOVOS_ALARMES = 'alarmes:novos';
export const EVENTO_REGIAO = 'alarmes:regiao';

function lerCookie(cabecalho: string | undefined, nome: string): string | undefined {
  for (const par of (cabecalho ?? '').split(';')) {
    const [chave, ...valor] = par.trim().split('=');
    if (chave === nome) return decodeURIComponent(valor.join('='));
  }
  return undefined;
}

interface DadosCliente {
  autenticado: boolean;
  regiao?: Coordenadas;
}

/** Alarme acompanhado da posição da estação, usada só para filtrar por região. */
export interface AlarmeComPosicao {
  alarme: AlarmeHistoricoRespostaDto;
  posicao: Coordenadas;
}

// Canal público, como a tela de Alertas Globais. Quem está logado recebe todos
// os alarmes; o visitante precisa informar a região (evento "alarmes:regiao")
// e só recebe os de estações a até RAIO_REGIAO_KM dele. O CORS é lido de
// process.env porque o decorator é avaliado ao importar o módulo (o main.ts
// carrega o .env antes disso).
@WebSocketGateway({
  namespace: 'alarmes',
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
export class AlarmesGateway implements OnGatewayConnection {
  private readonly logger = new Logger(AlarmesGateway.name);

  @WebSocketServer()
  private readonly servidor!: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async handleConnection(cliente: Socket): Promise<void> {
    const dados: DadosCliente = { autenticado: await this.estaAutenticado(cliente) };
    cliente.data = dados;
  }

  @SubscribeMessage(EVENTO_REGIAO)
  definirRegiao(@ConnectedSocket() cliente: Socket, @MessageBody() corpo: unknown): { ok: boolean } {
    if (!coordenadasValidas(corpo)) return { ok: false };
    (cliente.data as DadosCliente).regiao = { latitude: corpo.latitude, longitude: corpo.longitude };
    return { ok: true };
  }

  emitirNovosAlarmes(alarmes: AlarmeComPosicao[]): void {
    for (const cliente of this.servidor.sockets.values()) {
      const visiveis = this.filtrarPara(cliente.data as DadosCliente | undefined, alarmes);
      if (visiveis.length > 0) cliente.emit(EVENTO_NOVOS_ALARMES, visiveis);
    }
  }

  private filtrarPara(dados: DadosCliente | undefined, alarmes: AlarmeComPosicao[]): AlarmeHistoricoRespostaDto[] {
    if (dados?.regiao) {
      const regiao = dados.regiao;
      return alarmes.filter(({ posicao }) => distanciaKm(regiao, posicao) <= RAIO_REGIAO_KM).map(({ alarme }) => alarme);
    }
    // Visitante que ainda não informou a região não recebe nada.
    return dados?.autenticado ? alarmes.map(({ alarme }) => alarme) : [];
  }

  private async estaAutenticado(cliente: Socket): Promise<boolean> {
    const token = lerCookie(cliente.handshake.headers.cookie, 'access_token');
    if (!token) return false;

    try {
      const payload = this.jwtService.verify<PayloadJwt>(token);
      const usuario = await this.usuariosService.buscarPorId(payload.sub);
      return usuario.ativo;
    } catch {
      this.logger.debug(`Cookie inválido no websocket de alarmes (${cliente.id}); tratado como visitante`);
      return false;
    }
  }
}
