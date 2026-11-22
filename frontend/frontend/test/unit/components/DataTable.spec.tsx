import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from '@/components/DataTable';

interface Linha {
  id: string;
  nome: string;
  ativo: boolean;
}

const colunas: Column<Linha>[] = [
  { header: 'Nome', key: 'nome' },
  { header: 'Status', key: 'ativo', render: (ativo) => (ativo ? 'Ativo' : 'Inativo') },
];

const linhas: Linha[] = [
  { id: '1', nome: 'Ana', ativo: true },
  { id: '2', nome: 'Bruno', ativo: false },
];

function renderizar(props: { data?: Linha[]; currentPage?: number; totalPages?: number; isLoading?: boolean } = {}) {
  const onPageChange = vi.fn();
  render(
    <DataTable<Linha>
      columns={colunas}
      data={props.data ?? linhas}
      currentPage={props.currentPage ?? 1}
      totalPages={props.totalPages ?? 1}
      isLoading={props.isLoading}
      onPageChange={onPageChange}
      rowKey="id"
    />,
  );
  return { onPageChange };
}

describe('DataTable', () => {
  it('mostra os cabeçalhos e uma linha por registro, usando o render da coluna', () => {
    renderizar();

    expect(screen.getByRole('columnheader', { name: 'Nome' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Ana Ativo' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Bruno Inativo' })).toBeInTheDocument();
  });

  it('mostra "Carregando..." no lugar dos registros enquanto busca', () => {
    renderizar({ isLoading: true });

    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByText('Ana')).not.toBeInTheDocument();
  });

  it('avisa quando não há registros', () => {
    renderizar({ data: [] });

    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('esconde a paginação quando tudo cabe em uma página', () => {
    renderizar({ totalPages: 1 });

    expect(screen.queryByText(/Página/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('navega para a página anterior e para a próxima', async () => {
    const usuario = userEvent.setup();
    const { onPageChange } = renderizar({ currentPage: 2, totalPages: 3 });
    const [anterior, proxima] = screen.getAllByRole('button');

    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();

    await usuario.click(anterior);
    await usuario.click(proxima);

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('desabilita "anterior" na primeira página', () => {
    renderizar({ currentPage: 1, totalPages: 2 });
    const [anterior, proxima] = screen.getAllByRole('button');

    expect(anterior).toBeDisabled();
    expect(proxima).toBeEnabled();
  });

  it('desabilita "próxima" na última página', () => {
    renderizar({ currentPage: 2, totalPages: 2 });
    const [anterior, proxima] = screen.getAllByRole('button');

    expect(anterior).toBeEnabled();
    expect(proxima).toBeDisabled();
  });
});
