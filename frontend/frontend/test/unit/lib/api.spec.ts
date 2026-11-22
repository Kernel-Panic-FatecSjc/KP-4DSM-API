import { describe, expect, it } from 'vitest';
import { api, API_URL, ErroApi } from '@/lib/api';
import { mockarFetch, responde } from '../helpers';


describe('api', () => {
  it('chama a API enviando o cookie de sessão e o corpo em JSON', async () => {
    const fetchMock = mockarFetch(responde(200, { id: '1' }));


    const resposta = await api<{ id: string }>('/usuarios', { method: 'POST', body: '{"nome":"Ana"}' });


    expect(resposta).toEqual({ id: '1' });
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/usuarios`, {
      method: 'POST',
      body: '{"nome":"Ana"}',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  });


  it('mantém os cabeçalhos extras junto do Content-Type', async () => {
    const fetchMock = mockarFetch(responde(200, {}));


    await api('/alarmes', { headers: { 'X-Origem': 'teste' } });


    expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Origem': 'teste',
    });
  });


  it('lança ErroApi com o status e a mensagem devolvidos pela API', async () => {
    mockarFetch(responde(401, { message: 'Credenciais inválidas' }));


    const erro = await api('/autenticacao/login').catch((e: unknown) => e);


    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ status: 401, message: 'Credenciais inválidas' });
  });


  it('junta mensagens de validação devolvidas como lista', async () => {
    mockarFetch(responde(400, { message: ['UF inválida', 'Nome obrigatório'] }));


    await expect(api('/orgaos')).rejects.toMatchObject({
      status: 400,
      message: 'UF inválida, Nome obrigatório',
    });
  });


  it('usa uma mensagem padrão quando o erro não vem em JSON', async () => {
    mockarFetch(() => Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 502 })));


    await expect(api('/dashboard')).rejects.toMatchObject({ status: 502, message: 'Erro inesperado' });
  });


  it('devolve null quando a resposta de sucesso não tem corpo', async () => {
    mockarFetch(() => Promise.resolve(new Response(null, { status: 204 })));


    await expect(api('/autenticacao/logout', { method: 'POST' })).resolves.toBeNull();
  });
});
