'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';

/**
 * Rotas dentro da área protegida que não exigem autenticação.
 * Adicione aqui o caminho (ou prefixo) de qualquer página que deva
 * ficar acessível mesmo sem login, sem precisar tirá-la deste grupo.
 */
const EXCECOES: string[] = [];


function ehExcecao(pathname: string): boolean {
  return EXCECOES.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`));
}

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const excecao = ehExcecao(pathname);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    if (excecao) return;

    let ativo = true;

    api('/autenticacao/perfil')
      .then(() => {
        if (ativo) setAutenticado(true);
      })
      .catch((erro) => {
        if (!ativo) return;
        const proximo = encodeURIComponent(pathname);
        router.replace(erro instanceof ErroApi ? `/login?proximo=${proximo}` : '/login');
      });

    return () => {
      ativo = false;
    };
  }, [excecao, pathname, router]);

  if (excecao) {
    return <>{children}</>;
  }

  if (!autenticado) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-zinc-500">Verificando autenticação...</p>
      </main>
    );
  }

  return <>{children}</>;
}
