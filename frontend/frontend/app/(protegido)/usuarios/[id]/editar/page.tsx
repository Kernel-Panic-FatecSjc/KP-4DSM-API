'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { api, ErroApi } from '@/lib/api';

export default function EditarUsuarioPage(props: PageProps<'/usuarios/[id]/editar'>) {
  const { id } = use(props.params);
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      await api(`/usuarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nome: nome || undefined,
          email: email || undefined,
          senha: senha || undefined,
        }),
      });
      router.push('/usuarios');
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao atualizar');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Editar usuário</h1>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="text"
          placeholder="Novo nome (opcional)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="email"
          placeholder="Novo email (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          type="password"
          placeholder="Nova senha (opcional, mínimo 8 caracteres)"
          minLength={8}
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
          {carregando ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </main>
  );
}
