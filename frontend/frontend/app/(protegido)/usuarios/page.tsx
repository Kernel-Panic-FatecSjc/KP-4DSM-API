'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/DataTable';
import { api, ErroApi, type TipoUsuario, type Usuario } from '@/lib/api';
import { ehTecsus, podeCadastrar, ROTULO_PERFIL, somenteLeitura } from '@/lib/perfil';

const ITEMS_PER_PAGE = 10;

type FiltroStatus = 'TODOS' | 'ATIVOS' | 'INATIVOS';

const PERFIS: TipoUsuario[] = ['ADMIN_TECSUS', 'ADMIN_LICITACAO', 'USUARIO_LICITACAO'];

/** Espelha a regra do backend: a Tecsus gerencia todos; o admin da licitação, só os usuários comuns dela. */
function podeGerenciar(logado: Usuario, alvo: Usuario): boolean {
  if (somenteLeitura(logado)) return false;
  if (ehTecsus(logado)) return true;
  return (
    logado.tipo === 'ADMIN_LICITACAO' &&
    alvo.tipo === 'USUARIO_LICITACAO' &&
    alvo.licitacao !== null &&
    alvo.licitacao.id === logado.licitacao?.id
  );
}

export default function UsuariosPage() {
  const router = useRouter();
  const usuarioLogado = useUsuario();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FiltroStatus>('TODOS');
  const [filtroLicitacao, setFiltroLicitacao] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState<TipoUsuario | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [novoNome, setNovoNome] = useState('');
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoPerfil, setNovoPerfil] = useState<TipoUsuario>('USUARIO_LICITACAO');
  const [novaLicitacao, setNovaLicitacao] = useState('');
  const [criando, setCriando] = useState(false);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);

  const tecsus = ehTecsus(usuarioLogado);
  const administrador = tecsus || usuarioLogado?.tipo === 'ADMIN_LICITACAO';
  const cadastra = podeCadastrar(usuarioLogado);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Licitação e perfil a API filtra (e só aceita da Tecsus); busca e status
    // ficam na tela, para filtrar enquanto digita.
    const parametros = new URLSearchParams();
    if (filtroLicitacao) parametros.set('licitacaoId', filtroLicitacao);
    if (filtroPerfil) parametros.set('tipo', filtroPerfil);
    const query = parametros.toString();

    try {
      setUsuarios(await api<Usuario[]>(`/usuarios${query ? `?${query}` : ''}`));
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
        router.replace('/login?proximo=/usuarios');
        return;
      }
      setError(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao carregar usuários');
    } finally {
      setIsLoading(false);
    }
  }, [filtroLicitacao, filtroPerfil, router]);

  useEffect(() => {
    if (!administrador) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca a listagem ao montar a página e ao mudar os filtros
    void loadUsers();
  }, [administrador, loadUsers]);

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

    // O admin da licitação não escolhe nada: o backend cadastra um usuário
    // comum na licitação dele.
    let corpo: Record<string, string> = { nome: novoNome, email: novoEmail, senha: novaSenha };
    if (tecsus) {
      if (novoPerfil !== 'ADMIN_TECSUS' && !novaLicitacao) {
        setError('Selecione a licitação do usuário.');
        return;
      }
      corpo = { ...corpo, tipo: novoPerfil, ...(novoPerfil !== 'ADMIN_TECSUS' && { licitacaoId: novaLicitacao }) };
    }

    setCriando(true);
    try {
      const criado = await api<Usuario>('/usuarios', { method: 'POST', body: JSON.stringify(corpo) });
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
    { header: 'Nome', key: 'nome', render: (nome) => <span className="whitespace-nowrap">{String(nome)}</span> },
    { header: 'E-mail', key: 'email' },
    {
      header: 'Perfil',
      key: 'tipo',
      render: (_, usuario) => <span className="whitespace-nowrap">{ROTULO_PERFIL[usuario.tipo]}</span>,
    },
    {
      header: 'Licitação',
      key: 'licitacao',
      render: (_, usuario) =>
        usuario.licitacao ? (
          <span className="whitespace-nowrap font-mono text-xs" title={usuario.licitacao.orgaoNome}>
            {usuario.licitacao.codigoIdentificador}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Tecsus</span>
        ),
    },
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
      render: (id, usuario) => {
        const proprio = String(id) === usuarioLogado?.id;
        const gerencia = usuarioLogado !== null && podeGerenciar(usuarioLogado, usuario);
        // Cada um edita os próprios dados; os de outra pessoa, só quem a gerencia.
        const edita = proprio ? !somenteLeitura(usuarioLogado) : gerencia;

        if (!edita && !gerencia && !proprio) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }

        return (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {edita && (
              <Link href={`/usuarios/${id}/editar`} className="text-xs font-medium text-aqua hover:underline">
                Editar
              </Link>
            )}
            {proprio ? (
              <span
                className="text-xs text-muted-foreground"
                title="Não é possível inativar o próprio usuário"
              >
                (você)
              </span>
            ) : (
              gerencia && (
                <button
                  type="button"
                  onClick={() => void handleAlterarStatus(usuario)}
                  disabled={alterandoId === usuario.id}
                  className={`text-xs font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${usuario.ativo ? 'text-destructive' : 'text-lime'}`}
                >
                  {alterandoId === usuario.id ? 'Salvando...' : usuario.ativo ? 'Inativar' : 'Ativar'}
                </button>
              )
            )}
          </div>
        );
      },
    },
  ];

  if (!usuarioLogado) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando perfil...</p>;
  }

  if (!administrador) {
    return (
      <div role="alert" className="rounded-md border border-border bg-card p-6 text-sm">
        Esta página está disponível somente para administradores.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="Usuários"
        description={
          tecsus
            ? 'Gerencie os acessos de todas as licitações e da Tecsus.'
            : `Gerencie os usuários da licitação ${usuarioLogado.licitacao?.codigoIdentificador ?? ''}.`
        }
      />

      {cadastra && (
        <form
          onSubmit={handleCriar}
          aria-label="Cadastrar usuário"
          className="rise delay-1 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 sm:items-end"
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

          {tecsus ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="novoPerfil" className="font-mono text-[10px] uppercase text-muted-foreground">
                  Perfil
                </label>
                <Select
                  id="novoPerfil"
                  value={novoPerfil}
                  onChange={(e) => setNovoPerfil(e.target.value as TipoUsuario)}
                >
                  {PERFIS.map((perfil) => (
                    <option key={perfil} value={perfil}>{ROTULO_PERFIL[perfil]}</option>
                  ))}
                </Select>
              </div>
              {novoPerfil !== 'ADMIN_TECSUS' && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="novaLicitacao" className="font-mono text-[10px] uppercase text-muted-foreground">
                    Licitação
                  </label>
                  <SeletorLicitacao id="novaLicitacao" valor={novaLicitacao} onChange={setNovaLicitacao} />
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-2 lg:self-center">
              O usuário entra como {ROTULO_PERFIL.USUARIO_LICITACAO.toLowerCase()} em{' '}
              <strong className="font-mono">{usuarioLogado.licitacao?.codigoIdentificador}</strong>.
            </p>
          )}

          <Button type="submit" disabled={criando} className="sm:justify-self-start">
            {criando ? 'Criando...' : 'Cadastrar'}
          </Button>
        </form>
      )}

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
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadUsers()}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section
        aria-label="Filtros de usuários"
        className={`rise delay-1 grid gap-2.5 sm:grid-cols-2 ${tecsus ? 'lg:grid-cols-4' : ''}`}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="buscaUsuario" className="font-mono text-[10px] uppercase text-muted-foreground">Buscar</label>
          <Input
            id="buscaUsuario"
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por nome ou email..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="statusUsuario" className="font-mono text-[10px] uppercase text-muted-foreground">Status</label>
          <Select
            id="statusUsuario"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as FiltroStatus); setCurrentPage(1); }}
          >
            <option value="TODOS">Todos os status</option>
            <option value="ATIVOS">Ativos</option>
            <option value="INATIVOS">Inativos</option>
          </Select>
        </div>

        {tecsus && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="filtroLicitacaoUsuario" className="font-mono text-[10px] uppercase text-muted-foreground">
                Licitação
              </label>
              <SeletorLicitacao
                id="filtroLicitacaoUsuario"
                valor={filtroLicitacao}
                onChange={(licitacaoId) => { setFiltroLicitacao(licitacaoId); setCurrentPage(1); }}
                rotuloTodas="Todas as licitações"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filtroPerfilUsuario" className="font-mono text-[10px] uppercase text-muted-foreground">
                Perfil
              </label>
              <Select
                id="filtroPerfilUsuario"
                value={filtroPerfil}
                onChange={(e) => { setFiltroPerfil(e.target.value as TipoUsuario | ''); setCurrentPage(1); }}
              >
                <option value="">Todos os perfis</option>
                {PERFIS.map((perfil) => (
                  <option key={perfil} value={perfil}>{ROTULO_PERFIL[perfil]}</option>
                ))}
              </Select>
            </div>
          </>
        )}
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
