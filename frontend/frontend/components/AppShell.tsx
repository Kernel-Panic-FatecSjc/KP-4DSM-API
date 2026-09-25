'use client';

import { Bell, ClipboardList, Database, LayoutDashboard, LogOut, Menu, MapPin, PanelLeftClose, PanelLeftOpen, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Alertas Globais', href: '/alertas-globais', icon: Bell },
  { label: 'Gerenciamento de Alertas', href: '/gerenciamento-de-alertas', icon: Bell },
  { label: 'Alerta Log', href: '/alerta-log', icon: Bell },
  { label: 'Estações', href: '/estacoes', icon: MapPin },
  { label: 'Leituras brutas', href: '/leituras-brutas', icon: Database },
  { label: 'Usuários', href: '/usuarios', icon: Users },
  { label: 'Auditoria', href: '/auditoria', icon: ClipboardList },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const tituloAtual = NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ?? 'Painel';

  async function handleLogout() {
    await api('/autenticacao/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen bg-background font-body text-foreground antialiased">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-60',
          mobileOpen ? 'w-60 translate-x-0' : 'w-60 -translate-x-full',
        )}
        aria-label="Navegação principal"
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="grid size-7 shrink-0 place-items-center rounded-[5px] bg-lime font-display text-sm font-bold text-lime-foreground">
            K
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="font-display font-semibold text-sidebar-foreground">KP-4DSM</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-3">
          {(!collapsed || mobileOpen) && (
            <p className="px-2 py-1.5 font-mono text-[10px] uppercase text-sidebar-muted">Operação</p>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const ativo = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                <Button
                  variant="ghost"
                  className={cn(
                    'h-9 w-full justify-start px-3 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    ativo && 'bg-lime text-lime-foreground hover:bg-lime hover:text-lime-foreground',
                    collapsed && !mobileOpen && 'justify-center px-0',
                  )}
                  title={collapsed && !mobileOpen ? item.label : undefined}
                >
                  <Icon className="shrink-0" />
                  {(!collapsed || mobileOpen) && <span>{item.label}</span>}
                </Button>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              'h-9 w-full justify-start px-3 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed && !mobileOpen && 'justify-center px-0',
            )}
            title={collapsed && !mobileOpen ? 'Sair' : undefined}
          >
            <LogOut className="shrink-0" />
            {(!collapsed || mobileOpen) && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-overlay md:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding] duration-200',
          collapsed ? 'md:pl-16' : 'md:pl-60',
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <p className="truncate font-display text-[15px] font-semibold">{tituloAtual}</p>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
