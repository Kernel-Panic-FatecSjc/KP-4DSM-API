'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type Usuario } from '@/lib/api';

export default function UsuariosPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [perfilAtual, lista] = await Promise.all([
        api<Usuario>('/autenticacao/perfil'),
        api<Usuario[]>('/usuarios'),
      ]);
      setPerfil(perfilAtual);
      setUsuarios(lista);
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
        router.push('/login');
        return;
      }
      setErro('Erro ao carregar usuários');
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca a listagem protegida ao montar a página
    carregar();
  }, [carregar]);

  async function handleLogout() {
    await api('/autenticacao/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleCriar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setCriando(true);

    try {
      const criado = await api<Usuario>('/usuarios', {
        method: 'POST',
        body: JSON.stringify({ nome: novoNome, email: novoEmail, senha: novaSenha }),
      });
      setUsuarios((atual) => [...(atual ?? []), criado]);
      setNovoNome('');
      setNovoEmail('');
      setNovaSenha('');
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao criar usuário');
    } finally {
      setCriando(false);
    }
  }

  async function handleInativar(id: string) {
    if (!confirm('Inativar este usuário? Ele deixa de conseguir logar e a sessão atual dele é encerrada.')) {
      return;
    }

    try {
      await api(`/usuarios/${id}`, { method: 'DELETE' });
      setUsuarios(
        (atual) => atual?.map((usuario) => (usuario.id === id ? { ...usuario, ativo: false } : usuario)) ?? null,
      );
    } catch {
      setErro('Erro ao inativar usuário');
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuários</h1>
          {perfil && (
            <p className="text-sm text-zinc-600">
              Logado como {perfil.nome} · Perfil: Administrador
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Link href="/alarmes" className="rounded border px-3 py-1.5 text-sm">
            Histórico de alertas
          </Link>
          <button onClick={handleLogout} className="rounded border px-3 py-1.5 text-sm">
            Sair
          </button>
        </div>
      </div>

      <form onSubmit={handleCriar} className="flex max-w-2xl flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="novoNome" className="text-sm">
            Novo usuário
          </label>
          <input
            id="novoNome"
            type="text"
            placeholder="Nome"
            required
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>
        <input
          type="email"
          placeholder="Email"
          required
          value={novoEmail}
          onChange={(e) => setNovoEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Senha (mínimo 8 caracteres)"
          required
          minLength={8}
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={criando}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {criando ? 'Criando...' : 'Criar'}
        </button>
      </form>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {!usuarios ? (
        <p>Carregando...</p>
      ) : (
        <table className="w-full max-w-3xl border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Nome</th>
              <th className="py-2">Email</th>
              <th className="py-2">Status</th>
              <th className="py-2">Data de cadastro</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-b">
                <td className="py-2">{usuario.nome}</td>
                <td className="py-2">{usuario.email}</td>
                <td className="py-2">
                  <span className={usuario.ativo ? 'text-green-700' : 'text-zinc-400'}>
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="py-2">{new Date(usuario.criadoEm).toLocaleDateString('pt-BR')}</td>
                <td className="flex gap-3 py-2">
                  <Link href={`/usuarios/${usuario.id}/editar`} className="underline">
                    Editar
                  </Link>
                  {usuario.ativo && (
                    <button onClick={() => handleInativar(usuario.id)} className="text-red-600 underline">
                      Inativar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
