'use client';

import { AlertTriangle, Clock3, MapPin, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, type AlarmeHistorico, type SeveridadeAlerta } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRegiao } from './RegiaoVisitante';
import { Button } from './ui/button';

const EVENTO_NOVOS_ALARMES = 'alarmes:novos';
const EVENTO_REGIAO = 'alarmes:regiao';

/** Disparado na janela a cada lote recebido, para telas abertas recarregarem seus dados. */
export const EVENTO_JANELA_NOVOS_ALARMES = 'kp:novos-alarmes';

const PESO_SEVERIDADE: Record<SeveridadeAlerta, number> = { ATENCAO: 0, ALERTA: 1, EMERGENCIA: 2 };

const LABEL_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'Atenção',
  ALERTA: 'Alerta',
  EMERGENCIA: 'Emergência',
};

const COR_SELO_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'bg-aqua/10 text-aqua',
  ALERTA: 'bg-warning/10 text-warning',
  EMERGENCIA: 'bg-critical/10 text-critical',
};

const COR_BARRA_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'bg-aqua',
  ALERTA: 'bg-warning',
  EMERGENCIA: 'bg-critical',
};

function formatarNumero(valor: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(valor);
}

function maisGrave(alarmes: AlarmeHistorico[]): AlarmeHistorico {
  return alarmes.reduce((atual, alarme) =>
    PESO_SEVERIDADE[alarme.severidade] > PESO_SEVERIDADE[atual.severidade] ? alarme : atual,
  );
}

/**
 * Escuta o websocket de alarmes da API e abre um modal quando algum dispara.
 * Quem está logado recebe todos; o visitante informa a região ao servidor e
 * só recebe os alarmes de estações próximas dele.
 */
export function AlertaTempoReal() {
  const [pendentes, setPendentes] = useState<AlarmeHistorico[]>([]);
  const { regiao } = useRegiao();
  const socketRef = useRef<Socket | null>(null);
  const regiaoRef = useRef(regiao);

  useEffect(() => {
    const socket = io(`${API_URL}/alarmes`, { withCredentials: true });
    socketRef.current = socket;

    // A região fica guardada só na conexão: a cada (re)conexão é reenviada.
    socket.on('connect', () => {
      const atual = regiaoRef.current;
      if (atual) socket.emit(EVENTO_REGIAO, { latitude: atual.latitude, longitude: atual.longitude });
    });

    socket.on(EVENTO_NOVOS_ALARMES, (novos: AlarmeHistorico[]) => {
      if (novos.length === 0) return;
      setPendentes((atuais) => [...novos, ...atuais]);
      window.dispatchEvent(new CustomEvent(EVENTO_JANELA_NOVOS_ALARMES));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    regiaoRef.current = regiao;
    if (regiao && socketRef.current?.connected) {
      socketRef.current.emit(EVENTO_REGIAO, { latitude: regiao.latitude, longitude: regiao.longitude });
    }
  }, [regiao]);

  const fechar = useCallback(() => setPendentes([]), []);

  useEffect(() => {
    if (pendentes.length === 0) return;

    function fecharComEsc(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar();
    }

    window.addEventListener('keydown', fecharComEsc);
    return () => window.removeEventListener('keydown', fecharComEsc);
  }, [pendentes.length, fechar]);

  if (pendentes.length === 0) return null;

  const alarme = maisGrave(pendentes);
  const outros = pendentes.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={fechar}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alarme-tempo-real-titulo"
        aria-describedby="alarme-tempo-real-descricao"
        onClick={(evento) => evento.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-xl bg-card shadow-xl"
      >
        <div className={cn('h-1.5', COR_BARRA_SEVERIDADE[alarme.severidade])} />

        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium',
                  COR_SELO_SEVERIDADE[alarme.severidade],
                )}
              >
                <AlertTriangle className="size-4" />
                {LABEL_SEVERIDADE[alarme.severidade]}
              </span>
              <h2 id="alarme-tempo-real-titulo" className="mt-3 font-display text-lg font-semibold">
                Novo alarme disparado
              </h2>
            </div>
            <button type="button" onClick={fechar} className="rounded-md p-2 hover:bg-muted" aria-label="Fechar alerta">
              <X className="size-5" />
            </button>
          </div>

          <div id="alarme-tempo-real-descricao" className="rounded-lg border border-border bg-muted p-4">
            <div className="text-xs text-muted-foreground">{alarme.parametro.nome}</div>
            <div className="mt-1 font-mono text-2xl font-semibold text-critical">
              {formatarNumero(alarme.valorMedido)}{' '}
              <span className="text-sm text-muted-foreground">{alarme.parametro.unidade}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Limite configurado: {formatarNumero(alarme.valorLimite)} {alarme.parametro.unidade}
            </div>

            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{alarme.estacao.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs">
                  {new Date(alarme.disparadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
                </span>
              </div>
            </div>
          </div>

          {outros > 0 && (
            <p className="text-sm text-muted-foreground">
              E mais {outros} {outros === 1 ? 'alarme disparado' : 'alarmes disparados'} desde o último aviso.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={fechar}>
              Fechar
            </Button>
            <Link href="/alertas-globais" onClick={fechar}>
              <Button>Ver histórico</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
