'use client';

import { LocateFixed, MapPin } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CAPITAIS_POR_UF, RAIO_REGIAO_KM, regiaoDaUf, type Regiao } from '@/lib/regiao';
import { useSessao } from './ProtectedLayout';
import { Button } from './ui/button';
import { Select } from './ui/select';

const CHAVE_UF_SALVA = 'kp:regiao-uf';

type EstadoLocalizacao = 'inicial' | 'localizando' | 'negada' | 'indisponivel';

interface ContextoRegiao {
  /** Visitante sem login: a API só responde com a região informada. */
  exigida: boolean;
  /** Pode consultar a API: logado, ou visitante que já informou a região. */
  pronta: boolean;
  regiao: Regiao | null;
  localizacao: EstadoLocalizacao;
  usarLocalizacao: () => void;
  escolherUf: (uf: string) => void;
  trocarRegiao: () => void;
}

const RegiaoContext = createContext<ContextoRegiao>({
  exigida: false,
  pronta: false,
  regiao: null,
  localizacao: 'inicial',
  usarLocalizacao: () => undefined,
  escolherUf: () => undefined,
  trocarRegiao: () => undefined,
});

export function useRegiao(): ContextoRegiao {
  return useContext(RegiaoContext);
}

function lerUfSalva(): string | null {
  try {
    return localStorage.getItem(CHAVE_UF_SALVA);
  } catch {
    return null;
  }
}

function salvarUf(uf: string | null) {
  try {
    if (uf) localStorage.setItem(CHAVE_UF_SALVA, uf);
    else localStorage.removeItem(CHAVE_UF_SALVA);
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): só não lembra na próxima visita.
  }
}

/**
 * Guarda a região do visitante (localização do navegador ou estado escolhido).
 * Para quem está logado não faz nada: a API devolve tudo sem filtro.
 */
export function RegiaoProvider({ children }: { children: React.ReactNode }) {
  const sessao = useSessao();
  const exigida = sessao === 'visitante';
  const [regiao, setRegiao] = useState<Regiao | null>(null);
  const [localizacao, setLocalizacao] = useState<EstadoLocalizacao>('inicial');

  const usarLocalizacao = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocalizacao('indisponivel');
      return;
    }

    setLocalizacao('localizando');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        salvarUf(null);
        setRegiao({ latitude: coords.latitude, longitude: coords.longitude, descricao: 'sua localização' });
        setLocalizacao('inicial');
      },
      (erro) => setLocalizacao(erro.code === erro.PERMISSION_DENIED ? 'negada' : 'indisponivel'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  }, []);

  const escolherUf = useCallback((uf: string) => {
    const escolhida = regiaoDaUf(uf);
    if (!escolhida) return;
    salvarUf(uf);
    setRegiao(escolhida);
  }, []);

  const trocarRegiao = useCallback(() => {
    salvarUf(null);
    setRegiao(null);
    setLocalizacao('inicial');
  }, []);

  useEffect(() => {
    if (!exigida || regiao) return;
    // Quem já escolheu um estado antes volta direto para ele; os demais
    // recebem o pedido de localização do navegador uma vez, ao abrir a página.
    const ufSalva = lerUfSalva();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura a escolha salva ao identificar o visitante
    if (ufSalva) escolherUf(ufSalva);
    else usarLocalizacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na primeira vez que o visitante é identificado
  }, [exigida]);

  const pronta = sessao === 'autenticado' || (exigida && regiao !== null);

  return (
    <RegiaoContext.Provider
      value={{ exigida, pronta, regiao: exigida ? regiao : null, localizacao, usarLocalizacao, escolherUf, trocarRegiao }}
    >
      {children}
    </RegiaoContext.Provider>
  );
}

/** Pedido de região exibido ao visitante antes de mostrar os alertas. */
export function SeletorRegiao() {
  const { localizacao, usarLocalizacao, escolherUf } = useRegiao();

  const mensagem = {
    inicial: 'Permita o acesso à sua localização ou escolha seu estado.',
    localizando: 'Obtendo sua localização...',
    negada: 'Você não liberou a localização. Escolha seu estado para continuar.',
    indisponivel: 'Não foi possível obter sua localização. Escolha seu estado para continuar.',
  }[localizacao];

  return (
    <section className="rise mx-auto max-w-lg rounded-lg border border-border bg-card p-6 text-center">
      <MapPin className="mx-auto mb-3 size-8 text-aqua" />
      <h2 className="font-display text-lg font-semibold">Alertas perto de você</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Mostramos os alertas das estações num raio de {RAIO_REGIAO_KM} km. {mensagem}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          variant="outline"
          className="sm:flex-1"
          onClick={usarLocalizacao}
          disabled={localizacao === 'localizando'}
        >
          <LocateFixed />
          Usar minha localização
        </Button>
        <Select
          aria-label="Escolher estado"
          defaultValue=""
          onChange={(evento) => escolherUf(evento.target.value)}
          className="sm:flex-1"
        >
          <option value="" disabled>
            Escolher estado
          </option>
          {Object.entries(CAPITAIS_POR_UF).map(([uf, estado]) => (
            <option key={uf} value={uf}>
              {estado.nome}
            </option>
          ))}
        </Select>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Pelo estado, o raio é contado a partir da capital. Sua localização não é armazenada.
      </p>
    </section>
  );
}

/** Faixa que lembra ao visitante qual região está sendo exibida. */
export function FaixaRegiao() {
  const { regiao, trocarRegiao } = useRegiao();
  if (!regiao) return null;

  return (
    <div className="rise mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2.5 text-sm">
      <MapPin className="size-4 shrink-0 text-aqua" />
      <span>
        Alertas num raio de {RAIO_REGIAO_KM} km de <strong>{regiao.descricao}</strong>
      </span>
      <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={trocarRegiao}>
        Trocar região
      </Button>
    </div>
  );
}
