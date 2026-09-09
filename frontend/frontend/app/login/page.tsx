'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ErroApi, type Usuario } from '@/lib/api';

function destinoSeguro(proximo: string | null): string {
  if (proximo && proximo.startsWith('/') && !proximo.startsWith('//')) {
    return proximo;
  }
  return '/usuarios';
}

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      // o backend retorna os dados do usuário (incluindo o nome) para uso na UI
      await api<Usuario>('/autenticacao/login', {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      });
      router.push(destinoSeguro(searchParams.get('proximo')));
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao fazer login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
      <input
        type="email"
        placeholder="Email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border px-3 py-2"
      />
      <input
        type="password"
        placeholder="Senha"
        required
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        className="rounded border px-3 py-2"
      />

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="submit"
        disabled={carregando}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {carregando ? 'Entrando...' : 'Entrar'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Login</h1>
      <Suspense fallback={null}>
        <FormularioLogin />
      </Suspense>
    </main>
  );
}
