'use client';

import { useMemo, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/DataTable';

type Alerta = {
  id: string;
  nome: string;
  codigo: string;
  estagio: 'Entrada' | 'Processo' | 'Fechamento';
  severidade: 'crítico' | 'alto' | 'normal';
  tempo: string;
};

const alertasBase: Alerta[] = [
  { id: '1', nome: 'Sem resposta do turno', codigo: 'AL-2841', estagio: 'Processo', severidade: 'crítico', tempo: '3 min' },
  { id: '2', nome: 'Sinal fora da faixa', codigo: 'AL-2848', estagio: 'Entrada', severidade: 'alto', tempo: '11 min' },
  { id: '3', nome: 'Estoque de bateria baixo', codigo: 'AL-2838', estagio: 'Fechamento', severidade: 'normal', tempo: '34 min' },
  { id: '4', nome: 'Discrepância de registro', codigo: 'AL-2835', estagio: 'Processo', severidade: 'alto', tempo: '1 h' },
  { id: '5', nome: 'Operador desconectado', codigo: 'AL-2831', estagio: 'Entrada', severidade: 'normal', tempo: '2 h' },
  { id: '6', nome: 'Sensor com falha', codigo: 'AL-2810', estagio: 'Entrada', severidade: 'crítico', tempo: '5 h' },
  { id: '7', nome: 'Pedido atrasado', codigo: 'AL-2874', estagio: 'Processo', severidade: 'alto', tempo: '7 h' },
  { id: '8', nome: 'Inventário divergente', codigo: 'AL-2891', estagio: 'Fechamento', severidade: 'normal', tempo: '9 h' },
];

type FiltroSeveridade = 'TODOS' | 'crítico' | 'alto' | 'normal';

const ITEMS_PER_PAGE = 5;

export default function AlertasPage() {
  const [alertas] = useState<Alerta[]>(alertasBase);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [severidadeFilter, setSeveridadeFilter] = useState<FiltroSeveridade>('TODOS');

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return alertas.filter((a) => {
      const matchesSearch = !query || a.nome.toLowerCase().includes(query) || a.codigo.toLowerCase().includes(query);
      const matchesSeveridade = severidadeFilter === 'TODOS' || a.severidade === severidadeFilter;
      return matchesSearch && matchesSeveridade;
    });
  }, [alertas, searchTerm, severidadeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedAlerts = filtered.slice((safeCurrentPage - 1) * ITEMS_PER_PAGE, safeCurrentPage * ITEMS_PER_PAGE);

  const columns: Column<Alerta>[] = [
    { header: 'Código', key: 'codigo' },
    { header: 'Alerta', key: 'nome' },
    { header: 'Estágio', key: 'estagio' },
    {
      header: 'Severidade',
      key: 'severidade',
      render: (sev) => (
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${
          sev === 'crítico' ? 'bg-critical/10 border-critical/30 text-critical' :
          sev === 'alto' ? 'bg-warning/10 border-warning/30 text-warning' :
          'bg-lime/10 border-lime/30 text-lime'
        }`}>
          {String(sev).charAt(0).toUpperCase() + String(sev).slice(1)}
        </span>
      ),
    },
    { header: 'Tempo', key: 'tempo' },
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Alertas"
        description="Acompanhe e resolva ocorrências operacionais."
      />

      <section className="rise delay-1 grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Total de alertas</p>
          <p className="mt-2 font-display text-2xl font-semibold">{filtered.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">ocorrências registradas</p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Críticos</p>
          <p className="mt-2 font-display text-2xl font-semibold">{filtered.filter((a) => a.severidade === 'crítico').length}</p>
          <p className="mt-1 text-xs text-muted-foreground">requerem atenção imediata</p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Em processo</p>
          <p className="mt-2 font-display text-2xl font-semibold">{filtered.filter((a) => a.estagio === 'Processo').length}</p>
          <p className="mt-1 text-xs text-muted-foreground">sendo analisados</p>
        </article>
      </section>

      <section className="rise delay-0 grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="search" className="font-mono text-[10px] uppercase text-muted-foreground">Buscar</label>
          <Input
            id="search"
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por código ou nome..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="severidade" className="font-mono text-[10px] uppercase text-muted-foreground">Severidade</label>
          <select
            id="severidade"
            value={severidadeFilter}
            onChange={(e) => { setSeveridadeFilter(e.target.value as FiltroSeveridade); setCurrentPage(1); }}
            className="rounded border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="TODOS">Todas as severidades</option>
            <option value="crítico">Crítico</option>
            <option value="alto">Alto</option>
            <option value="normal">Normal</option>
          </select>
        </div>
      </section>

      <DataTable<Alerta>
        columns={columns}
        data={paginatedAlerts}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        isLoading={false}
        rowKey="id"
      />
    </div>
  );
}
