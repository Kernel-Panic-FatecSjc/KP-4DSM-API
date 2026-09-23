'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ErroApi, type ListaAuditoria, type Usuario } from '@/lib/api';

function formatarDataHora(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(valor));
}

function formatarDetalhes(valor: unknown): string {
  if (valor === null || valor === undefined) return '-';
  if (typeof valor === 'string') return valor;
  return JSON.stringify(valor);
}

export default function AuditoriaPage() {
  const router = useRouter();
  const [lista, setLista] = useState<ListaAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState('');
  const [entidade, setEntidade] = useState('');
  const [entidadeId, setEntidadeId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  async function carregar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault();
    setCarregando(true);
    setErro(null);

    const parametros = new URLSearchParams({ tamanho: '50' });
    if (acao) parametros.set('acao', acao);
    if (entidade) parametros.set('entidade', entidade);
    if (entidadeId) parametros.set('entidadeId', entidadeId);
    if (usuarioId) parametros.set('usuarioId', usuarioId);
    if (de) parametros.set('de', new Date(`${de}T00:00:00`).toISOString());
    if (ate) parametros.set('ate', new Date(`${ate}T23:59:59.999`).toISOString());

    try {
      const perfil = await api<Usuario>('/autenticacao/perfil');
      if (perfil.tipo !== 'ADMINISTRADOR') {
        router.replace('/dashboard');
        return;
      }
      setLista(await api<ListaAuditoria>(`/auditoria?${parametros.toString()}`));
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && (erroCapturado.status === 401 || erroCapturado.status === 403)) {
        router.replace(erroCapturado.status === 401 ? '/login' : '/dashboard');
        return;
      }
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao carregar auditoria');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega a consulta protegida ao montar a página
    carregar();
  }, []);

  return (
    <div className="space-y-5">
      <PageHeading title="Auditoria" description="Consulte as ações realizadas no sistema e seus detalhes." />

      <form onSubmit={carregar} className="rise delay-1 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="auditoriaAcao" className="font-mono text-[10px] uppercase text-muted-foreground">Ação</label>
          <Input id="auditoriaAcao" placeholder="ex.: usuarios.criar" value={acao} onChange={(e) => setAcao(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="auditoriaEntidade" className="font-mono text-[10px] uppercase text-muted-foreground">Recurso</label>
          <Input id="auditoriaEntidade" placeholder="ex.: usuarios" value={entidade} onChange={(e) => setEntidade(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="auditoriaUsuario" className="font-mono text-[10px] uppercase text-muted-foreground">ID do usuário</label>
          <Input id="auditoriaUsuario" placeholder="UUID do usuário" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="auditoriaEntidadeId" className="font-mono text-[10px] uppercase text-muted-foreground">ID do recurso</label>
          <Input id="auditoriaEntidadeId" placeholder="UUID do recurso" value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="auditoriaDe" className="font-mono text-[10px] uppercase text-muted-foreground">De</label>
          <Input id="auditoriaDe" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="auditoriaAte" className="font-mono text-[10px] uppercase text-muted-foreground">Até</label>
          <Input id="auditoriaAte" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
        <Button type="submit" className="sm:col-span-2 lg:col-span-5 lg:justify-self-end" disabled={carregando}>
          <Search />
          {carregando ? 'Consultando...' : 'Consultar'}
        </Button>
      </form>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <article className="rise delay-2 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-aqua" />
            <div>
              <h2 className="font-display text-sm font-semibold">Registros de atividade</h2>
              <p className="font-mono text-[10px] text-muted-foreground">{lista ? `${lista.total} registro(s)` : 'Carregando...'}</p>
            </div>
          </div>
        </div>

        {carregando && !lista ? (
          <div className="grid min-h-40 place-items-center px-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : lista?.itens.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Data/hora</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="px-4 py-3 font-medium">Recurso</th>
                  <th className="px-4 py-3 font-medium">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {lista.itens.map((registro) => (
                  <tr key={registro.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">{formatarDataHora(registro.criadoEm)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{registro.usuario?.nome ?? 'Sistema'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-aqua">{registro.acao}</td>
                    <td className="px-4 py-3">{registro.entidade}{registro.entidadeId ? <span className="block max-w-36 truncate font-mono text-[10px] text-muted-foreground">{registro.entidadeId}</span> : null}</td>
                    <td className="max-w-80 px-4 py-3 font-mono text-xs text-muted-foreground">{formatarDetalhes(registro.detalhes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-40 place-items-center px-6 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>
        )}
      </article>
    </div>
  );
}