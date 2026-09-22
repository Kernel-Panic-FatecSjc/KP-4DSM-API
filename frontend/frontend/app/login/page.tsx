'use client';

import styles from './App.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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
    <form onSubmit={handleSubmit} className={styles.formulario}>
        <h1 className={styles.titulo}>Login</h1>
        <h2 className={styles.subtitulo}>Faça login na sua conta</h2>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.emailInput} />
        <input
          type="password"
          placeholder="Senha"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className={styles.senhaInput} />

        {erro && <p className={styles.erro}>{erro}</p>}

        <button
          type="submit"
          disabled={carregando}
          className={styles.entrarButton}
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
  );
}

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SKIP_LOGIN === 'true') {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <main className={styles.main}>
      <section className={styles.painelFormulario}>
        <Suspense fallback={null}>
          <FormularioLogin />
        </Suspense>
      </section>
      <div className={styles.painel} aria-hidden="true" />
    </main>
  );
}




