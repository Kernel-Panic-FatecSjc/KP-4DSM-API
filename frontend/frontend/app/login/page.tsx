'use client';

import styles from './App.module.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, ErroApi, type Usuario } from '@/lib/api';

function destinoSeguro(proximo: string | null): string {
  if (proximo && proximo.startsWith('/') && !proximo.startsWith('//')) {
    return proximo;
  }
  return '/dashboard';
}

function IconeEnvelope() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={styles.icone}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconeCadeado() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={styles.icone}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconeOlho({ fechado = false }: { fechado?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={styles.iconeOlho}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      {fechado ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
          <path d="M9.9 4.3A10.8 10.8 0 0 1 12 4c5 0 8.5 4 9.8 6.1a3.5 3.5 0 0 1 0 .4 16 16 0 0 1-3.1 3.5" />
          <path d="M6.2 6.2A16 16 0 0 0 2.2 10a3.5 3.5 0 0 0 0 .4C3.5 12.5 7 16 12 16c1 0 2-.2 2.9-.5" />
        </>
      ) : (
        <>
          <path d="M2.2 12C3.5 9.9 7 6 12 6s8.5 3.9 9.8 6c-1.3 2.1-4.8 6-9.8 6s-8.5-3.9-9.8-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
    </svg>
  );
}

function FormularioLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
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
      setErro(
        erroCapturado instanceof ErroApi
          ? erroCapturado.message
          : 'Erro ao fazer login',
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formulario}>
      <div className={styles.cabecalho}>
        <span className={styles.marca}>DATA PANIC</span>

        <h1 className={styles.titulo}>Login</h1>

        <p className={styles.subtitulo}>
          Faça login na sua conta para continuar.
        </p>
      </div>

      <div className={styles.campos}>
        <div className={styles.campo}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>

          <div className={styles.inputWrapper}>
            <span className={styles.iconeContainer}>
              <IconeEnvelope />
            </span>

            <input
              id="email"
              type="email"
              placeholder="Digite seu email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.campo}>
          <label htmlFor="senha" className={styles.label}>
            Senha
          </label>

          <div className={styles.inputWrapper}>
            <span className={styles.iconeContainer}>
              <IconeCadeado />
            </span>

            <input
              id="senha"
              type={senhaVisivel ? 'text' : 'password'}
              placeholder="Digite sua senha"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={styles.input}
            />

            <button
              type="button"
              className={styles.botaoOlho}
              onClick={() => setSenhaVisivel((visivel) => !visivel)}
              aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <IconeOlho fechado={!senhaVisivel} />
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <p className={styles.erro} role="alert">
          {erro}
        </p>
      )}

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
  return (
    <main className={styles.main}>
      <section className={styles.painelFormulario}>
        <Suspense fallback={null}>
          <FormularioLogin />
        </Suspense>
      </section>

      <aside className={styles.painel} aria-hidden="true">
        <div className={`${styles.decoracao} ${styles.decoracaoUm}`} />
        <div className={`${styles.decoracao} ${styles.decoracaoDois}`} />
        <div className={`${styles.decoracao} ${styles.decoracaoTres}`} />

        <div className={styles.conteudoPainel}>
          <span className={styles.painelMarca}>DATA PANIC</span>

          <h2 className={styles.painelTitulo}>
            Plataforma de gestão da Defesa Civil
          </h2>

          <p className={styles.painelTexto}>
            Acesse a plataforma para acompanhar suas informações de forma
            simples, segura e centralizada.
          </p>

          <div className={styles.linhaDecorativa}>
            <span />
            <span />
            <span />
          </div>
        </div>
      </aside>
    </main>
  );
}