
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, Users, UserCheck, UserX, X } from 'lucide-react';
import SideBarAdmin from '@/components/SideBar/SideBarAdmin';
import { api, ErroApi, type Usuario } from '@/lib/api';

const ITEMS_PER_PAGE = 6;

type FiltroStatus = 'TODOS' | 'ATIVOS' | 'INATIVOS';

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

  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FiltroStatus>('TODOS');
  const [currentPage, setCurrentPage] = useState(1);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [perfilAtual, lista] = await Promise.all([
        api<Usuario>('/autenticacao/perfil'),
        api<Usuario[]>('/usuarios'),
      ]);

      setPerfil(perfilAtual);
      setUsuarios(lista);
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
        router.replace('/login?proximo=/buscar-usuarios');
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
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca perfil e listagem ao montar a página
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
    searchTerm.trim() || statusFilter !== 'TODOS',
  );

  function handleClearFilters() {
    setSearchTerm('');
    setStatusFilter('TODOS');
    setCurrentPage(1);
  }

  async function handleLogout() {
    try {
      await api('/autenticacao/logout', {
        method: 'POST',
      });
    } finally {
      router.replace('/login');
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <SideBarAdmin />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Defesa Civil
              </h2>

              <p className="text-xs text-slate-500">
                Painel Administrativo
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-800">
                  {perfil?.nome ?? 'Carregando...'}
                </p>

                <p className="text-xs text-slate-400">
                  {perfil?.email ?? ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">
          <div className="mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Gestão de Acessos
            </span>

            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Usuários do Sistema
            </h1>

            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Consulte os usuários cadastrados e filtre os registros por
              nome, e-mail ou status.
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
              <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
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
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as FiltroStatus);
                    setCurrentPage(1);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="TODOS">Todos os status</option>
                  <option value="ATIVOS">Ativos</option>
                  <option value="INATIVOS">Inativos</option>
                </select>
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
                  <span className="col-span-5">Nome</span>
                  <span className="col-span-4">E-mail</span>
                  <span className="col-span-3 text-right">Status</span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {paginatedUsers.map((usuario) => (
                    <li
                      key={usuario.id}
                      className="px-6 py-4 transition hover:bg-slate-50/60"
                    >
                      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                        <div className="sm:col-span-5">
                          <p className="text-sm font-semibold text-slate-800">
                            {usuario.nome}
                          </p>
                        </div>

                        <div className="sm:col-span-4">
                          <p className="text-xs text-slate-500">
                            {usuario.email}
                          </p>
                        </div>

                        <div className="flex justify-start sm:col-span-3 sm:justify-end">
                          <StatusBadge ativo={usuario.ativo} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!isLoading && !error && filteredUsers.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3">
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
        </main>
      </div>
    </div>
  );
}
