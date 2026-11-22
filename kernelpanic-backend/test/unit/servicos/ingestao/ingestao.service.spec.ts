import { Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IngestaoService } from '../../../../servicos/ingestao/ingestao.service';
import { LeiturasBrutasRepositorio } from '../../../../servicos/ingestao/leituras-brutas.repositorio';
import { PrismaService } from '../../../../src/prisma/prisma.service';
import {
  ESTACAO_COM_COORDENADAS,
  ESTACAO_COM_TIPOS,
  LEITURAS,
  TIPO_CHUVA,
  VID_ESTACAO,
} from '../../../fixtures';

describe('IngestaoService', () => {
  let service: IngestaoService;
  const prismaMock = { estacao: { findUnique: jest.fn() } };
  const repositorioMock = { registrar: jest.fn() };
  const configMock = { get: jest.fn() };
  const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(async () => {
    jest.clearAllMocks();
    // lote grande e intervalo alto: nos testes o flush é sempre manual, via service.flush()
    configMock.get.mockImplementation((chave: string) => {
      if (chave === 'INGESTAO_LOTE_TENTATIVAS_MAX') return 3;
      if (chave === 'INGESTAO_ENCERRAMENTO_PRAZO_MS') return 1000;
      return chave === 'INGESTAO_LOTE_TAMANHO_MAX' ? 999_999 : 999_999_999;
    });
    repositorioMock.registrar.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestaoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: LeiturasBrutasRepositorio, useValue: repositorioMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(IngestaoService);
  });

  afterEach(async () => {
    await service.beforeApplicationShutdown();
  });

  describe('receber', () => {
    it('enfileira o pacote em leituras_brutas e grava no flush, com o GPS enviado pelo dispositivo', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);

      const resposta = await service.receber({
        vid: VID_ESTACAO,
        unixtime: 1_760_000_000,
        latitude: -22.9,
        longitude: -45.1,
        leituras: LEITURAS,
      });

      expect(prismaMock.estacao.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vid: VID_ESTACAO } }),
      );
      expect(resposta).toMatchObject({ estacaoId: 'estacao-1', sensoresRecebidos: 3 });
      expect(resposta.leituraBrutaId).toMatch(REGEX_UUID);
      // ainda não gravou: só acumulou no buffer até o próximo flush
      expect(repositorioMock.registrar).not.toHaveBeenCalled();

      await service.flush();

      expect(repositorioMock.registrar).toHaveBeenCalledWith([
        {
          id: resposta.leituraBrutaId,
          vidEstacao: VID_ESTACAO,
          payload: LEITURAS,
          latitude: -22.9,
          longitude: -45.1,
          unixtimeDispositivo: 1_760_000_000,
        },
      ]);
    });

    it('cai para as coordenadas do cadastro quando o dispositivo não envia GPS', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);

      await service.receber({ vid: VID_ESTACAO, leituras: LEITURAS });
      await service.flush();

      expect(repositorioMock.registrar).toHaveBeenCalledWith([
        expect.objectContaining({ latitude: -23.1, longitude: -45.8 }),
      ]);
    });

    it('usa o horário do servidor quando o lote não informa unixtime', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);
      const antes = Math.floor(Date.now() / 1000);

      await service.receber({ vid: VID_ESTACAO, leituras: LEITURAS });
      await service.flush();

      const [[[gravada]]] = repositorioMock.registrar.mock.calls;
      expect(gravada.unixtimeDispositivo).toBeGreaterThanOrEqual(antes);
    });

    it('lança NotFoundException quando o vid não corresponde a nenhuma estação', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(
        service.receber({ vid: 'DESCONHECIDA', leituras: LEITURAS }),
      ).rejects.toBeInstanceOf(NotFoundException);

      await service.flush();
      expect(repositorioMock.registrar).not.toHaveBeenCalled();
    });

    it('informa estacaoInativa a partir do cadastro (quem descarta a medida é o tratamento)', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue({ ...ESTACAO_COM_COORDENADAS, statusOperacional: 'INATIVA' });

      const resposta = await service.receber({ vid: VID_ESTACAO, leituras: { temperatura: 25 } });
      await service.flush();

      expect(resposta.estacaoInativa).toBe(true);
      expect(repositorioMock.registrar).toHaveBeenCalledWith([expect.objectContaining({ payload: { temperatura: 25 } })]);
    });

    it('guarda a estação em cache: mensagens seguidas do mesmo vid não consultam o banco de novo', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);

      await service.receber({ vid: VID_ESTACAO, leituras: LEITURAS });
      await service.receber({ vid: VID_ESTACAO, leituras: LEITURAS });

      expect(prismaMock.estacao.findUnique).toHaveBeenCalledTimes(1);
    });

    it('grava dois envios do mesmo instante como duas leituras brutas (a deduplicação é do tratamento)', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);

      await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: { temperatura: 25 } });
      await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: { temperatura: 25 } });
      await service.flush();

      expect(repositorioMock.registrar.mock.calls[0][0]).toHaveLength(2);
    });
  });

  describe('flush com falha', () => {
    const FALHA = new Error('banco fora do ar');
    beforeEach(() => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);
    });

    const idsGravados = (chamada: number) =>
      repositorioMock.registrar.mock.calls[chamada][0].map((leitura: { id: string }) => leitura.id);

    it('devolve o lote à fila e grava na tentativa seguinte, junto com as leituras novas', async () => {
      repositorioMock.registrar.mockRejectedValueOnce(FALHA);

      const primeira = await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      await service.flush();
      const segunda = await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_060, leituras: LEITURAS });
      await service.flush();

      expect(repositorioMock.registrar).toHaveBeenCalledTimes(2);
      expect(idsGravados(1)).toEqual([primeira.leituraBrutaId, segunda.leituraBrutaId]);

      await service.flush();
      expect(repositorioMock.registrar).toHaveBeenCalledTimes(2);
    });

    it('tenta de novo no próximo flush mesmo sem leituras novas', async () => {
      repositorioMock.registrar.mockRejectedValueOnce(FALHA);

      const leitura = await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      await service.flush();
      await service.flush();

      expect(idsGravados(1)).toEqual([leitura.leituraBrutaId]);
    });

    it('descarta com log de erro detalhado ao esgotar as tentativas', async () => {
      const logErro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      repositorioMock.registrar.mockRejectedValue(FALHA);

      const leitura = await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      for (let tentativa = 0; tentativa < 3; tentativa++) await service.flush();

      expect(repositorioMock.registrar).toHaveBeenCalledTimes(3);
      const mensagens = logErro.mock.calls.map(([mensagem]) => String(mensagem)).join('\n');
      expect(mensagens).toContain('Descartando 1 leitura(s) bruta(s) após 3 tentativa(s) de gravação: banco fora do ar');
      expect(mensagens).toContain(leitura.leituraBrutaId);

      await service.flush();
      expect(repositorioMock.registrar).toHaveBeenCalledTimes(3);
      logErro.mockRestore();
    });

    it('insiste nas falhas ao encerrar até gravar o lote pendente', async () => {
      repositorioMock.registrar.mockRejectedValueOnce(FALHA);

      const leitura = await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      await service.beforeApplicationShutdown();

      expect(repositorioMock.registrar).toHaveBeenCalledTimes(2);
      expect(idsGravados(1)).toEqual([leitura.leituraBrutaId]);
    });

    it('o flush pedido durante outro espera ele terminar e reenvia o que falhou', async () => {
      let falharPrimeira!: (erro: Error) => void;
      repositorioMock.registrar.mockImplementationOnce(
        () => new Promise((_resolve, reject) => (falharPrimeira = reject)),
      );

      const leitura = await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      const primeiro = service.flush();
      await new Promise(setImmediate);
      const segundo = service.flush();

      falharPrimeira(FALHA);
      await Promise.all([primeiro, segundo]);

      expect(repositorioMock.registrar).toHaveBeenCalledTimes(2);
      expect(idsGravados(1)).toEqual([leitura.leituraBrutaId]);
    });

    it('mantém no máximo um flush na fila', async () => {
      let liberarPrimeiro!: (total: number) => void;
      repositorioMock.registrar.mockImplementationOnce(
        () => new Promise((resolve) => (liberarPrimeiro = resolve)),
      );

      await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      const primeiro = service.flush();
      await new Promise(setImmediate);
      await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_060, leituras: LEITURAS });
      const naFila = [service.flush(), service.flush(), service.flush()];

      liberarPrimeiro(1);
      await Promise.all([primeiro, ...naFila]);

      expect(repositorioMock.registrar).toHaveBeenCalledTimes(2);
    });

    it('responde 503 às leituras que chegam depois de o encerramento começar', async () => {
      const encerramento = service.beforeApplicationShutdown();

      await expect(
        service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await encerramento;
      expect(repositorioMock.registrar).not.toHaveBeenCalled();
    });

    it('descarta com log ao estourar o prazo de encerramento com o banco pendurado', async () => {
      const logErro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      repositorioMock.registrar.mockImplementation(() => new Promise(() => undefined));

      const leitura = await service.receber({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      const inicio = Date.now();
      await service.beforeApplicationShutdown();

      expect(Date.now() - inicio).toBeLessThan(2000);
      const mensagens = logErro.mock.calls.map(([mensagem]) => String(mensagem)).join('\n');
      expect(mensagens).toContain('Descartando 1 leitura(s) bruta(s) após encerramento sem concluir a gravação');
      expect(mensagens).toContain(leitura.leituraBrutaId);
      logErro.mockRestore();
      repositorioMock.registrar.mockReset();
    });
  });

  describe('listarParametros', () => {
    it('devolve os tipos de parâmetro da estação com os dados de calibração', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_TIPOS);

      const resposta = await service.listarParametros(VID_ESTACAO);

      expect(resposta).toEqual({
        estacaoId: 'estacao-1',
        vid: VID_ESTACAO,
        nome: 'Estação Centro',
        parametros: [
          { tipoParametroId: TIPO_CHUVA, nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2 },
        ],
      });
    });

    it('lança NotFoundException para vid desconhecido', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(service.listarParametros('DESCONHECIDA')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
