'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ErroApi, type Usuario } from '@/lib/api';
import { cn } from '@/lib/utils';

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const lista = await api<Usuario[]>('/usuarios');
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
    <div className="space-y-5">
      <PageHeading title="Usuários" description="Gerencie os acessos ao painel operacional." />

      <form
        onSubmit={handleCriar}
        className="rise delay-1 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="novoNome" className="font-mono text-[10px] uppercase text-muted-foreground">
            Nome
          </label>
          <Input id="novoNome" placeholder="Nome" required value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="novoEmail" className="font-mono text-[10px] uppercase text-muted-foreground">
            Email
          </label>
          <Input
            id="novoEmail"
            type="email"
            placeholder="nome@empresa.com"
            required
            value={novoEmail}
            onChange={(e) => setNovoEmail(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="novaSenha" className="font-mono text-[10px] uppercase text-muted-foreground">
            Senha
          </label>
          <Input
            id="novaSenha"
            type="password"
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={criando}>
          {criando ? 'Criando...' : 'Cadastrar'}
        </Button>
      </form>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <article className="rise delay-2 overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-display text-sm font-semibold">Equipe cadastrada</h2>
            <p className="font-mono text-[10px] text-muted-foreground">
              {usuarios ? `${usuarios.length} usuário(s)` : 'Carregando...'}
            </p>
          </div>
        </div>

        {!usuarios ? (
          <div className="grid min-h-40 place-items-center px-6 text-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : (
          usuarios.map((usuario) => (
            <div
              key={usuario.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border p-4 last:border-0 md:grid-cols-[1.5fr_1fr_auto]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-aqua/15 text-xs font-bold text-aqua">
                  {iniciais(usuario.nome)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{usuario.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{usuario.email}</p>
                </div>
              </div>
              <span className="hidden items-center gap-1.5 text-xs md:flex">
                <span className={cn('size-1.5 rounded-full', usuario.ativo ? 'bg-lime' : 'bg-muted-foreground')} />
                {usuario.ativo ? 'Ativo' : 'Inativo'}
              </span>
              <div className="flex justify-end gap-3 text-xs">
                <Link href={`/usuarios/${usuario.id}/editar`} className="font-medium text-aqua underline-offset-2 hover:underline">
                  Editar
                </Link>
                {usuario.ativo && (
                  <button
                    onClick={() => handleInativar(usuario.id)}
                    className="font-medium text-destructive underline-offset-2 hover:underline"
                  >
                    Inativar
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </article>
    </div>
  );
}
