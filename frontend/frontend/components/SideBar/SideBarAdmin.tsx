'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

type MenuItem = {
  label: string;
  href: string;
  icon: ReactNode;
};

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="8" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="10" cy="18" r="2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function LogoIcon() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 3v2" />
        <path d="M12 19v2" />
        <path d="m5.64 5.64 1.41 1.41" />
        <path d="m16.95 16.95 1.41 1.41" />
        <path d="M3 12h2" />
        <path d="M19 12h2" />
        <path d="m5.64 18.36 1.41-1.41" />
        <path d="m16.95 7.05 1.41-1.41" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    </div>
  );
}

const principalItems: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <GridIcon />,
  },
  {
    label: 'Análise por Período',
    href: '/analise-periodo',
    icon: <SlidersIcon />,
  },
  {
    label: 'Gerenciamento de Alertas',
    href: '/alertas',
    icon: <BellIcon />,
  },
  {
    label: 'Log de Alertas',
    href: '/log-alertas',
    icon: <FileIcon />,
  },
];

const administracaoItems: MenuItem[] = [
  {
    label: 'Usuários',
    href: '/buscar-usuarios',
    icon: <UsersIcon />,
  },
  {
    label: 'Estações',
    href: '/estacoes',
    icon: <MapPinIcon />,
  },
];

export default function SidebarAdmin() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  function isActive(href: string) {
    if (href === '/') {
      return pathname === '/';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col bg-[#0d1b3e] text-slate-400 transition-all duration-300 ${
        collapsed ? 'w-[76px]' : 'w-[240px]'
      }`}
    >
      <div className="flex h-[72px] items-center border-b border-white/10 px-3">
        <div
          className={`flex w-full items-center ${
            collapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!collapsed && (
            <Link href="/" className="flex items-center gap-3">
              <LogoIcon />

              <div>
                <p className="text-sm font-bold tracking-tight text-white">
                  Kernel Panic
                </p>

                <p className="text-xs text-slate-400">
                  Monitoramento
                </p>
              </div>
            </Link>
          )}

          {collapsed && (
            <Link href="/" aria-label="Ir para o dashboard">
              <LogoIcon />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {collapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && (
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Principal
          </p>
        )}

        <div className="space-y-1">
          {principalItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center rounded-lg py-2.5 text-sm font-medium transition-all ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-[#203f79] text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span
                  className={
                    active
                      ? 'text-white'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }
                >
                  {item.icon}
                </span>

                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>

                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>

        <div className="my-6 border-t border-white/10" />

        {!collapsed && (
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Administração
          </p>
        )}

        <div className="space-y-1">
          {administracaoItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`group flex items-center rounded-lg py-2.5 text-sm font-medium transition-all ${
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3'
                } ${
                  active
                    ? 'bg-[#203f79] text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <span
                  className={
                    active
                      ? 'text-white'
                      : 'text-slate-500 group-hover:text-slate-300'
                  }
                >
                  {item.icon}
                </span>

                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>

                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('mock-session');
            window.location.href = '/login';
          }}
          title={collapsed ? 'Sair' : undefined}
          className={`group flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-slate-200 ${
            collapsed ? 'justify-center px-2' : 'gap-3 px-3'
          }`}
        >
          <span className="text-slate-500 group-hover:text-slate-300">
            <LogoutIcon />
          </span>

          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

