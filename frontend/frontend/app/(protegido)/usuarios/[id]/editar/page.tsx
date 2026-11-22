'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api, ErroApi, type TipoUsuario, type Usuario } from '@/lib/api';
import { ehTecsus, ROTULO_PERFIL, somenteLeitura } from '@/lib/perfil';

const PERFIS: TipoUsuario[] = ['ADMIN_TECSUS', 'ADMIN_LICITACAO', 'USUARIO_LICITACAO'];

const CLASSE_ROTULO = 'font-mono text-[10px] uppercase text-muted-foreground';

export default function EditarUsuarioPage(props: PageProps<'/usuarios/[id]/editar'>) {
  const { id } = use(props.params);
  const router = useRouter();
  const usuarioLogado = useUsuario();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState<TipoUsuario>('USUARIO_LICITACAO');
  const [licitacaoId, setLicitacaoId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const proprio = id === usuarioLogado?.id;
  // Só a Tecsus muda perfil ou licitação, e nunca os próprios.
  const mudaPerfil = ehTecsus(usuarioLogado) && !proprio;

  useEffect(() => {
    let ativo = true;
    api<Usuario>(`/usuarios/${id}`)
      .then((resposta) => {
        if (!ativo) return;
        setUsuario(resposta);
        setNome(resposta.nome);
        setEmail(resposta.email);
        setTipo(resposta.tipo);
        setLicitacaoId(resposta.licitacao?.id ?? '');
      })
      .catch((erroCapturado: unknown) => {
        if (!ativo) return;
        setErroCarga(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao carregar o usuário');
      });
    return () => {
      ativo = false;
    };
  }, [id]);

  async function handleSubmit(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!usuario) return;
    setErro(null);

    // Só vai o que mudou: o backend audita os campos informados.
    const corpo: Record<string, string | null> = {};
    if (nome.trim() && nome.trim() !== usuario.nome) corpo.nome = nome.trim();
    if (email.trim() && email.trim() !== usuario.email) corpo.email = email.trim();
    if (senha) corpo.senha = senha;

    if (mudaPerfil) {
      const licitacaoAtual = usuario.licitacao?.id ?? '';
      if (tipo !== usuario.tipo) corpo.tipo = tipo;
      if (tipo === 'ADMIN_TECSUS') {
        if (licitacaoAtual) corpo.licitacaoId = null;
      } else if (!licitacaoId) {
        setErro('Selecione a licitação do usuário.');
        return;
      } else if (licitacaoId !== licitacaoAtual) {
        corpo.licitacaoId = licitacaoId;
      }
    }

    setCarregando(true);
    try {
      await api(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(corpo) });
      const administrador = ehTecsus(usuarioLogado) || usuarioLogado?.tipo === 'ADMIN_LICITACAO';
      router.push(administrador ? '/usuarios' : '/dashboard');
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao atualizar');
    } finally {
      setCarregando(false);
    }
  }

  if (somenteLeitura(usuarioLogado)) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <PageHeading title="Editar usuário" description="Acesso somente leitura." />
        <div role="alert" className="rounded-md border border-border bg-card p-5 text-sm">
          A licitação {usuarioLogado?.licitacao?.codigoIdentificador} não está vigente: não é possível alterar usuários.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <PageHeading title="Editar usuário" description="Altere os campos que deseja atualizar." />

      {erroCarga ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erroCarga}
        </div>
      ) : !usuario ? (
        <p className="text-sm text-muted-foreground">Carregando usuário...</p>
      ) : (
        <form onSubmit={handleSubmit} className="rise delay-1 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="nomeUsuario" className={CLASSE_ROTULO}>Nome</label>
            <Input id="nomeUsuario" type="text" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="emailUsuario" className={CLASSE_ROTULO}>Email</label>
            <Input id="emailUsuario" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="senhaUsuario" className={CLASSE_ROTULO}>Nova senha</label>
            <Input
              id="senhaUsuario"
              type="password"
              placeholder="Opcional, mínimo 8 caracteres"
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>

          {mudaPerfil ? (
            <>
              <div className="flex flex-col gap-1">
                <label htmlFor="perfilUsuario" className={CLASSE_ROTULO}>Perfil</label>
                <Select id="perfilUsuario" value={tipo} onChange={(e) => setTipo(e.target.value as TipoUsuario)}>
                  {PERFIS.map((perfil) => (
                    <option key={perfil} value={perfil}>{ROTULO_PERFIL[perfil]}</option>
                  ))}
                </Select>
              </div>
              {tipo !== 'ADMIN_TECSUS' && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="licitacaoUsuario" className={CLASSE_ROTULO}>Licitação</label>
                  <SeletorLicitacao id="licitacaoUsuario" valor={licitacaoId} onChange={setLicitacaoId} />
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              {ROTULO_PERFIL[usuario.tipo]}
              {usuario.licitacao && <> · <span className="font-mono">{usuario.licitacao.codigoIdentificador}</span></>}
            </p>
          )}

          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}

          <Button type="submit" disabled={carregando}>
            {carregando ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      )}
    </div>
  );
}
