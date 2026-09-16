'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="mx-auto max-w-md space-y-5">
      <PageHeading title="Editar usuário" description="Altere apenas os campos que deseja atualizar." />

      <form onSubmit={handleSubmit} className="rise delay-1 flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
        <Input type="text" placeholder="Novo nome (opcional)" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input type="email" placeholder="Novo email (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input
          type="password"
          placeholder="Nova senha (opcional, mínimo 8 caracteres)"
          minLength={8}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <Button type="submit" disabled={carregando}>
          {carregando ? 'Salvando...' : 'Salvar'}
        </Button>
      </form>
    </div>
  );
}
