'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, ErroApi, type Usuario } from '@/lib/api';

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
const UsuarioContext = createContext<Usuario | null>(null);

export function useSessao(): EstadoSessao {
  return useContext(SessaoContext);
}

export function useUsuario(): Usuario | null {
  return useContext(UsuarioContext);
}

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const publica = ehRotaPublica(pathname);
  const [sessao, setSessao] = useState<EstadoSessao>('verificando');
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  useEffect(() => {
    let ativo = true;

    api<Usuario>('/autenticacao/perfil')
      .then((perfil) => {
        if (ativo) {
          setUsuario(perfil);
          setSessao('autenticado');
        }
      })
      .catch((erro) => {
        if (!ativo) return;
        setUsuario(null);
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

  return (
    <UsuarioContext.Provider value={usuario}>
      <SessaoContext.Provider value={sessao}>{children}</SessaoContext.Provider>
    </UsuarioContext.Provider>
  );
}
