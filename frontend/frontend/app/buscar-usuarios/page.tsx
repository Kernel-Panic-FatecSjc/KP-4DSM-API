'use client';

import { useEffect, useMemo, useState } from 'react';
import SideBarAdmin from '@/components/SideBar/SideBarAdmin';

type UserRole = 'ADMINISTRADOR' | 'USUARIO';

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthenticatedUser {
  name: string;
  role: UserRole;
}

const USERS_API = 'http://localhost:3000/usuarios'; //endpoint backend

function useAuth(): {
  user: AuthenticatedUser | null;
  loading: boolean;
} {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessao = localStorage.getItem('mock-session');

    if (!sessao) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const usuario = JSON.parse(sessao);

      setUser({
        name: usuario.nome,
        role: usuario.role,
      });
    } catch {
      localStorage.removeItem('mock-session');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, loading };
}

async function fetchUsers(): Promise<PublicUser[]> {
  const response = await fetch(USERS_API);

  if (!response.ok) {
    throw new Error('Não foi possível carregar os usuários.');
  }

  const data = await response.json();

  return data;
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const isAdmin = role === 'ADMINISTRADOR';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        isAdmin
          ? 'bg-blue-50 text-blue-700'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isAdmin ? 'bg-blue-600' : 'bg-slate-400'
        }`}
      />
      {isAdmin ? 'Administrador' : 'Usuário'}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="animate-pulse px-5 py-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1.6fr_auto] sm:items-center sm:gap-6">
            <div className="h-4 w-40 rounded bg-slate-100" />
            <div className="h-4 w-52 rounded bg-slate-100" />
            <div className="h-7 w-28 rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/*
function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldIcon />
        </div>

        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Acesso restrito
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Esta área é exclusiva para administradores do sistema de Defesa
          Civil. Entre com uma conta de administrador para consultar os
          usuários cadastrados.
        </p>

        <a
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Voltar para o login
        </a>
      </div>
    </main>
  );
}
*/

export default function UsersAdminPage() {
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] =
    useState<'TODOS' | UserRole>('TODOS');

  const [currentPage, setCurrentPage] = useState(1);

  const usersPerPage = 5;

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError(null);

    fetchUsers()
      .then((data) => {
        if (active) {
          setUsers(data);
        }
      })
      .catch(() => {
        if (active) {
          setError('Não foi possível carregar os usuários.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return users.filter((userItem) => {
      const matchesSearch =
        term.length === 0 ||
        userItem.name.toLowerCase().includes(term) ||
        userItem.email.toLowerCase().includes(term);

      const matchesRole =
        roleFilter === 'TODOS' || userItem.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const totalUsers = users.length;

  const totalAdmins = users.filter(
    (userItem) => userItem.role === 'ADMINISTRADOR',
  ).length;

  const totalCommonUsers = users.filter(
    (userItem) => userItem.role === 'USUARIO',
  ).length;

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / usersPerPage),
  );

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * usersPerPage;

    return filteredUsers.slice(start, start + usersPerPage);
  }, [filteredUsers, currentPage]);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || roleFilter !== 'TODOS';

  function clearFilters() {
    setSearchTerm('');
    setRoleFilter('TODOS');
    setCurrentPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  function handleRoleChange(value: 'TODOS' | UserRole) {
    setRoleFilter(value);
    setCurrentPage(1);
  }

  function handlePreviousPage() {
    setCurrentPage((page) => Math.max(1, page - 1));
  }

  function handleNextPage() {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  }

  function handleLogout() {
    localStorage.removeItem('mock-session');
    window.location.href = '/login';
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          Verificando autenticação...
        </p>
      </main>
    );
  }

  /*
  if (!user || user.role !== 'ADMINISTRADOR') {
    return <AccessDenied />;
  }
  */

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <SideBarAdmin />

      <div className="flex-1">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Defesa Civil
              </p>

              <p className="text-xs text-slate-500">
                Painel administrativo
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {user?.name || 'Usuário'}
                </p>

                <p className="text-xs text-slate-500">
                  Administrador
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-8">
          <section className="mb-8">
            <p className="mb-1 text-sm font-semibold text-emerald-600">
              Administração
            </p>

            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Gerenciamento de usuários
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Consulte os usuários cadastrados e filtre os resultados
              por nome, e-mail ou perfil.
            </p>
          </section>

          <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              icon={<UsersIcon />}
              label="Total de usuários"
              value={totalUsers}
              description="Usuários cadastrados no sistema"
            />

            <StatCard
              icon={<ShieldIcon />}
              label="Administradores"
              value={totalAdmins}
              description="Usuários com acesso administrativo"
            />

            <StatCard
              icon={<UserIcon />}
              label="Usuários comuns"
              value={totalCommonUsers}
              description="Usuários com acesso padrão"
            />
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <SearchIcon />
                  </div>

                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) =>
                      handleSearchChange(event.target.value)
                    }
                    placeholder="Pesquisar por nome ou e-mail..."
                    aria-label="Pesquisar usuários por nome ou e-mail"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                  />

                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => handleSearchChange('')}
                      aria-label="Limpar busca"
                      className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-slate-400 hover:text-slate-600"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </div>

                <select
                  value={roleFilter}
                  onChange={(event) =>
                    handleRoleChange(
                      event.target.value as 'TODOS' | UserRole,
                    )
                  }
                  aria-label="Filtrar por perfil"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:bg-white lg:w-56"
                >
                  <option value="TODOS">Todos os perfis</option>
                  <option value="ADMINISTRADOR">
                    Administradores
                  </option>
                  <option value="USUARIO">Usuários</option>
                </select>
              </div>

              <div className="mt-4 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-slate-500">
                  {isLoading
                    ? 'Carregando usuários...'
                    : `${filteredUsers.length} ${
                        filteredUsers.length === 1
                          ? 'usuário encontrado'
                          : 'usuários encontrados'
                      }`}
                </p>

                {hasActiveFilters && !isLoading && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="w-fit font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>

            {error && !isLoading && (
              <div className="border-b border-red-100 bg-red-50 px-5 py-4">
                <p className="text-sm font-medium text-red-700">
                  {error}
                </p>
              </div>
            )}

            {isLoading ? (
              <LoadingState />
            ) : error ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-slate-500">
                  Tente novamente mais tarde.
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <SearchIcon />
                </div>

                <h2 className="mt-4 text-base font-semibold text-slate-800">
                  Nenhum usuário encontrado
                </h2>

                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Não encontramos usuários correspondentes aos
                  filtros aplicados.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
                <div className="hidden border-b border-slate-100 bg-slate-50 px-5 py-3 sm:grid sm:grid-cols-[1.5fr_1.6fr_auto] sm:gap-6">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Usuário
                  </span>

                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    E-mail
                  </span>

                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Perfil
                  </span>
                </div>

                <ul className="divide-y divide-slate-100">
                  {paginatedUsers.map((userItem) => (
                    <li
                      key={userItem.id}
                      className="px-5 py-4 hover:bg-slate-50"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1.6fr_auto] sm:items-center sm:gap-6">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {userItem.name}
                          </p>

                          <p className="mt-1 text-xs text-slate-400 sm:hidden">
                            {userItem.role === 'ADMINISTRADOR'
                              ? 'Administrador'
                              : 'Usuário'}
                          </p>
                        </div>

                        <p className="truncate text-sm text-slate-500">
                          {userItem.email}
                        </p>

                        <div className="w-fit">
                          <RoleBadge role={userItem.role} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {!isLoading &&
              !error &&
              filteredUsers.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
                  <p className="text-xs text-slate-400">
                    Página {currentPage} de {totalPages}
                  </p>

                  <div className="join">
                    <button
                      type="button"
                      className="join-item btn"
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                    >
                      «
                    </button>

                    <button
                      type="button"
                      className="join-item btn btn-active"
                    >
                      Página {currentPage}
                    </button>

                    <button
                      type="button"
                      className="join-item btn"
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                    >
                      »
                    </button>
                  </div>
                </div>
              )}
          </section>
        </main>
      </div>
    </div>
  );
}
