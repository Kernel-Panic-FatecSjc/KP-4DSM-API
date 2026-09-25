'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/DataTable';
import { api, ErroApi, type Usuario } from '@/lib/api';

const ITEMS_PER_PAGE = 10;

type FiltroStatus = 'TODOS' | 'ATIVOS' | 'INATIVOS';

export default function UsuariosPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioLogadoId, setUsuarioLogadoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FiltroStatus>('TODOS');
  const [currentPage, setCurrentPage] = useState(1);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [criando, setCriando] = useState(false);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [perfil, lista] = await Promise.all([
        api<Usuario>('/autenticacao/perfil'),
        api<Usuario[]>('/usuarios'),
      ]);
      setUsuarioLogadoId(perfil.id);
      setUsuarios(lista);
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
        router.replace('/login?proximo=/usuarios');
        return;
      }
      setError('Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca a listagem ao montar a página
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return usuarios.filter((usuario) => {
      const matchesSearch =
        !query ||
        usuario.nome.toLowerCase().includes(query) ||
        usuario.email.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'TODOS' ||
        (statusFilter === 'ATIVOS' && usuario.ativo) ||
        (statusFilter === 'INATIVOS' && !usuario.ativo);

      return matchesSearch && matchesStatus;
    });
  }, [usuarios, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter((usuario) => usuario.ativo).length;
    return { total, ativos, inativos: total - ativos };
  }, [usuarios]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, safeCurrentPage]);

  async function handleCriar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setCriando(true);

    try {
      const criado = await api<Usuario>('/usuarios', {
        method: 'POST',
        body: JSON.stringify({ nome: novoNome, email: novoEmail, senha: novaSenha }),
      });
      setUsuarios((atual) => [...atual, criado]);
      setNovoNome('');
      setNovoEmail('');
      setNovaSenha('');
      setCurrentPage(1);
    } catch (erroCapturado) {
      setError(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao criar usuário');
    } finally {
      setCriando(false);
    }
  }

  async function handleAlterarStatus(usuario: Usuario) {
    const inativando = usuario.ativo;
    const pergunta = inativando
      ? `Inativar ${usuario.nome}? Ele deixa de conseguir logar.`
      : `Ativar ${usuario.nome}? Ele volta a conseguir logar.`;
    if (!confirm(pergunta)) return;

    setError(null);
    setAlterandoId(usuario.id);

    try {
      if (inativando) {
        await api(`/usuarios/${usuario.id}`, { method: 'DELETE' });
      } else {
        await api(`/usuarios/${usuario.id}/ativar`, { method: 'PATCH' });
      }
      setUsuarios((atual) => atual.map((u) => (u.id === usuario.id ? { ...u, ativo: !inativando } : u)));
    } catch (erroCapturado) {
      const padrao = inativando ? 'Erro ao inativar usuário' : 'Erro ao ativar usuário';
      setError(erroCapturado instanceof ErroApi ? erroCapturado.message : padrao);
    } finally {
      setAlterandoId(null);
    }
  }

  const columns: Column<Usuario>[] = [
    { header: 'Nome', key: 'nome' },
    { header: 'E-mail', key: 'email' },
    {
      header: 'Status',
      key: 'ativo',
      render: (ativo) => (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${ativo ? 'bg-lime/10 border-lime/30 text-lime' : 'bg-muted border-border text-muted-foreground'}`}>
          {ativo ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },
    {
      header: 'Ações',
      key: 'id',
      render: (id, usuario) => (
        <div className="flex gap-2">
          <Link href={`/usuarios/${id}/editar`} className="text-xs font-medium text-aqua hover:underline">
            Editar
          </Link>
          {String(id) === usuarioLogadoId ? (
            <span
              className="text-xs text-muted-foreground"
              title="Não é possível inativar o próprio usuário"
            >
              (você)
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleAlterarStatus(usuario)}
              disabled={alterandoId === usuario.id}
              className={`text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${usuario.ativo ? 'text-destructive' : 'text-lime'}`}
            >
              {alterandoId === usuario.id ? 'Salvando...' : usuario.ativo ? 'Inativar' : 'Ativar'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Usuários"
        description="Gerencie os acessos ao painel operacional."
      />

      <form
        onSubmit={handleCriar}
        className="rise delay-1 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="novoNome" className="font-mono text-[10px] uppercase text-muted-foreground">
            Nome
          </label>
          <Input
            id="novoNome"
            placeholder="Nome"
            required
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
          />
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

      <section className="rise delay-1 grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Total de usuários</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">registros no sistema</p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Usuários ativos</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats.ativos}</p>
          <p className="mt-1 text-xs text-muted-foreground">com acesso habilitado</p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Usuários inativos</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats.inativos}</p>
          <p className="mt-1 text-xs text-muted-foreground">com acesso desabilitado</p>
        </article>
      </section>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadUsers()}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section className="rise delay-1 grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase text-muted-foreground">Buscar</label>
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por nome ou email..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase text-muted-foreground">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as FiltroStatus); setCurrentPage(1); }}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="TODOS">Todos os status</option>
            <option value="ATIVOS">Ativos</option>
            <option value="INATIVOS">Inativos</option>
          </select>
        </div>
      </section>

      <DataTable<Usuario>
        columns={columns}
        data={paginatedUsers}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        isLoading={isLoading}
        rowKey="id"
      />
    </div>
  );
}
