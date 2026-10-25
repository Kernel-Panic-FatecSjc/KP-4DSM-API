
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, Users, UserCheck, UserX, X } from 'lucide-react';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { api, ErroApi, type TipoUsuario, type Usuario } from '@/lib/api';
import { ehTecsus, ROTULO_PERFIL } from '@/lib/perfil';

const ITEMS_PER_PAGE = 6;

type FiltroStatus = 'TODOS' | 'ATIVOS' | 'INATIVOS';

const PERFIS: TipoUsuario[] = ['ADMIN_TECSUS', 'ADMIN_LICITACAO', 'USUARIO_LICITACAO'];

const CLASSE_FILTRO =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        ativo
          ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700'
          : 'border-slate-200/60 bg-slate-100 text-slate-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ativo ? 'bg-emerald-600' : 'bg-slate-400'
        }`}
      />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>

          <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
        <div
          key={index}
          className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-12 sm:gap-4"
        >
          <div className="h-4 animate-pulse rounded bg-slate-200 sm:col-span-5" />
          <div className="h-4 animate-pulse rounded bg-slate-200 sm:col-span-4" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200 sm:col-span-3 sm:ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function BuscarUsuariosPage() {
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

  const tecsus = ehTecsus(usuarioLogado);
  const administrador = tecsus || usuarioLogado?.tipo === 'ADMIN_LICITACAO';

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const parametros = new URLSearchParams();
    if (filtroLicitacao) parametros.set('licitacaoId', filtroLicitacao);
    if (filtroPerfil) parametros.set('tipo', filtroPerfil);
    const query = parametros.toString();

    try {
      setUsuarios(await api<Usuario[]>(`/usuarios${query ? `?${query}` : ''}`));
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
        router.replace('/login?proximo=/usuarios/listar');
        return;
      }

      setError(
        erroCapturado instanceof ErroApi
          ? erroCapturado.message
          : 'Não foi possível carregar os usuários.',
      );
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

    return {
      total,
      ativos,
      inativos: total - ativos,
    };
  }, [usuarios]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / ITEMS_PER_PAGE),
  );

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;

    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, safeCurrentPage]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() || statusFilter !== 'TODOS' || filtroLicitacao || filtroPerfil,
  );

  function handleClearFilters() {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setFiltroLicitacao('');
    setFiltroPerfil('');
    setCurrentPage(1);
  }

  if (!usuarioLogado) {
    return <p className="p-6 text-sm text-slate-500">Carregando perfil...</p>;
  }

  if (!administrador) {
    return (
      <div role="alert" className="rounded-xl border border-slate-200/80 bg-white p-6 text-sm shadow-sm">
        Esta página está disponível somente para administradores.
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col py-2 md:px-6 md:py-8">
          <div className="mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Gestão de Acessos
            </span>

            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Usuários do Sistema
            </h1>

            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Consulte os usuários cadastrados e filtre os registros por
              nome, e-mail, status{tecsus ? ', perfil ou licitação' : ''}.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Users size={20} />}
              label="Total de Usuários"
              value={stats.total}
              description="Registros retornados pela API"
            />

            <StatCard
              icon={<UserCheck size={20} />}
              label="Usuários Ativos"
              value={stats.ativos}
              description="Cadastros ativos no sistema"
            />

            <StatCard
              icon={<UserX size={20} />}
              label="Usuários Inativos"
              value={stats.inativos}
              description="Cadastros inativados no sistema"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="space-y-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex sm:items-center sm:justify-between sm:space-y-0 sm:gap-4">
              <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap">
                <div className="relative flex-1 sm:min-w-56">
                  <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                    <Search size={18} />
                  </div>

                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Buscar por nome ou e-mail..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />

                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setCurrentPage(1);
                      }}
                      className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-700"
                      aria-label="Limpar busca"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <select
                  aria-label="Status"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as FiltroStatus);
                    setCurrentPage(1);
                  }}
                  className={CLASSE_FILTRO}
                >
                  <option value="TODOS">Todos os status</option>
                  <option value="ATIVOS">Ativos</option>
                  <option value="INATIVOS">Inativos</option>
                </select>

                {tecsus && (
                  <>
                    <SeletorLicitacao
                      valor={filtroLicitacao}
                      onChange={(licitacaoId) => {
                        setFiltroLicitacao(licitacaoId);
                        setCurrentPage(1);
                      }}
                      rotuloTodas="Todas as licitações"
                      className={`h-auto w-auto ${CLASSE_FILTRO}`}
                    />

                    <select
                      aria-label="Perfil"
                      value={filtroPerfil}
                      onChange={(event) => {
                        setFiltroPerfil(event.target.value as TipoUsuario | '');
                        setCurrentPage(1);
                      }}
                      className={CLASSE_FILTRO}
                    >
                      <option value="">Todos os perfis</option>
                      {PERFIS.map((perfil) => (
                        <option key={perfil} value={perfil}>{ROTULO_PERFIL[perfil]}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="self-end text-xs font-semibold text-emerald-600 transition hover:text-emerald-700 sm:self-center"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            {error && !isLoading && (
              <div className="border-b border-slate-100 p-6 text-center">
                <p className="text-sm font-medium text-red-600">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  className="mt-3 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {isLoading ? (
              <TableSkeleton />
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Search size={20} />
                </div>

                <h3 className="text-sm font-semibold text-slate-800">
                  Nenhum resultado encontrado
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Não encontramos registros para os critérios pesquisados.
                </p>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="mt-4 rounded-lg bg-slate-100 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    Redefinir busca
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-12 gap-4 border-b border-slate-100 bg-slate-50/80 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 sm:grid">
                  <span className="col-span-4">Nome</span>
                  <span className="col-span-3">E-mail</span>
                  <span className="col-span-3">Perfil / licitação</span>
                  <span className="col-span-2 text-right">Status</span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {paginatedUsers.map((usuario) => (
                    <li
                      key={usuario.id}
                      className="px-4 py-4 transition hover:bg-slate-50/60 sm:px-6"
                    >
                      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                        <div className="sm:col-span-4">
                          <p className="text-sm font-semibold text-slate-800">
                            {usuario.nome}
                          </p>
                        </div>

                        <div className="min-w-0 sm:col-span-3">
                          <p className="break-words text-xs text-slate-500">
                            {usuario.email}
                          </p>
                        </div>

                        <div className="sm:col-span-3">
                          <p className="text-xs text-slate-700">
                            {ROTULO_PERFIL[usuario.tipo]}
                          </p>
                          <p className="font-mono text-xs text-slate-500" title={usuario.licitacao?.orgaoNome}>
                            {usuario.licitacao?.codigoIdentificador ?? 'Tecsus'}
                          </p>
                        </div>

                        <div className="flex justify-start sm:col-span-2 sm:justify-end">
                          <StatusBadge ativo={usuario.ativo} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!isLoading && !error && filteredUsers.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
                <p className="text-xs text-slate-500">
                  Mostrando{' '}
                  <span className="font-medium text-slate-700">
                    {paginatedUsers.length}
                  </span>{' '}
                  de{' '}
                  <span className="font-medium text-slate-700">
                    {filteredUsers.length}
                  </span>{' '}
                  resultados
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={safeCurrentPage === 1}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  <span className="px-2 text-xs font-medium text-slate-600">
                    {safeCurrentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((page) =>
                        Math.min(totalPages, page + 1),
                      )
                    }
                    disabled={safeCurrentPage === totalPages}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
