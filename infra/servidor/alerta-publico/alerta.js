// Página estática: lê dados/alertas.json (gravado pelo worker da API) a cada
// minuto. O atraso aleatório espalha os leitores, para o servidor não receber
// todos no mesmo segundo.
const ATUALIZAR_MS = 60 * 1000;
const ESPALHAR_MS = 30 * 1000;
const ROTULO = { ATENCAO: 'Atenção', ALERTA: 'Alerta', EMERGENCIA: 'Emergência' };

const lista = document.getElementById('lista');
const vazio = document.getElementById('vazio');
const atualizado = document.getElementById('atualizado');
const hora = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function desenhar({ atualizadoEm, alertas }) {
  lista.replaceChildren(
    ...alertas.map((a) => {
      const item = document.createElement('li');
      item.className = ROTULO[a.severidade] ? a.severidade : '';
      const titulo = document.createElement('strong');
      titulo.textContent = `${ROTULO[a.severidade] ?? a.severidade}: ${a.parametro} em ${a.estacao}`;
      const detalhe = document.createElement('span');
      detalhe.textContent = `${a.valor} ${a.unidade} · ${hora(a.disparadoEm)}`;
      item.append(titulo, detalhe);
      return item;
    }),
  );
  vazio.hidden = alertas.length > 0;
  atualizado.textContent = `Atualizado em ${hora(atualizadoEm)}`;
}

async function atualizar() {
  try {
    const resposta = await fetch('dados/alertas.json');
    if (!resposta.ok) throw new Error(String(resposta.status));
    desenhar(await resposta.json());
  } catch {
    // Mantém o que já está na tela; tenta de novo no próximo ciclo.
    if (!lista.children.length) atualizado.textContent = 'Não foi possível carregar os alertas agora.';
  }
  setTimeout(atualizar, ATUALIZAR_MS + Math.random() * ESPALHAR_MS);
}

atualizar();
