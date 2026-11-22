'use client';

import { useLicitacoes } from '@/lib/licitacoes';
import { ehTecsus } from '@/lib/perfil';
import { useUsuario } from './ProtectedLayout';
import { Select } from './ui/select';

interface SeletorLicitacaoProps {
  valor: string;
  onChange: (licitacaoId: string) => void;
  /** Rótulo da opção vazia; omitido, a escolha é obrigatória (ex.: cadastro). */
  rotuloTodas?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Filtro de licitação, só para a Tecsus: o usuário de licitação já tem os dados
 * filtrados pelo backend e não vê o seletor (o componente não renderiza nada).
 */
export function SeletorLicitacao({ valor, onChange, rotuloTodas, id, className, disabled }: SeletorLicitacaoProps) {
  const usuario = useUsuario();
  const tecsus = ehTecsus(usuario);
  const licitacoes = useLicitacoes(tecsus);

  if (!tecsus) return null;

  return (
    <Select
      id={id}
      aria-label="Licitação"
      className={className}
      value={valor}
      disabled={disabled}
      onChange={(evento) => onChange(evento.target.value)}
    >
      {rotuloTodas !== undefined ? <option value="">{rotuloTodas}</option> : <option value="" disabled>Selecione a licitação</option>}
      {licitacoes.map((licitacao) => (
        <option key={licitacao.id} value={licitacao.id}>
          {licitacao.codigoIdentificador} — {licitacao.orgaoNome}
        </option>
      ))}
    </Select>
  );
}
