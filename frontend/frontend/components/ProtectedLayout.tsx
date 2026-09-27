'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';

/**
 * Rotas dentro da área protegida que não exigem autenticação.
 * Adicione aqui o caminho (ou prefixo) de qualquer página que deva
 * ficar acessível mesmo sem login, sem precisar tirá-la deste grupo.
 * Os endpoints que a página consome também precisam de `@Publico()` na API.
 */
export const ROTAS_PUBLICAS: string[] = ['/alertas-globais'];

export function ehRotaPublica(pathname: string): boolean {
  return ROTAS_PUBLICAS.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

type EstadoSessao = 'verificando' | 'autenticado' | 'visitante';

const SessaoContext = createContext<EstadoSessao>('verificando');

export function useSessao(): EstadoSessao {
  return useContext(SessaoContext);
}

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const publica = ehRotaPublica(pathname);
  const [sessao, setSessao] = useState<EstadoSessao>('verificando');

  useEffect(() => {
    let ativo = true;

    api('/autenticacao/perfil')
      .then(() => {
        if (ativo) setSessao('autenticado');
      })
      .catch((erro) => {
        if (!ativo) return;
        if (publica) {
          setSessao('visitante');
          return;
        }
        const proximo = encodeURIComponent(pathname);
        router.replace(erro instanceof ErroApi ? `/login?proximo=${proximo}` : '/login');
      });

    return () => {
      ativo = false;
    };
  }, [publica, pathname, router]);

  if (!publica && sessao !== 'autenticado') {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-zinc-500">Verificando autenticação...</p>
      </main>
    );
  }

  return <SessaoContext.Provider value={sessao}>{children}</SessaoContext.Provider>;
}
