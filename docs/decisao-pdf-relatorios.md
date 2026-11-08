# Decisão — geração de PDF dos relatórios (RF09.4)

**Decisão:** o PDF dos relatórios 1, 2 e 3 (US09, US10 e US11) é gerado **no backend, com [pdfmake](https://pdfmake.github.io/docs/)**, a partir de um layout base comum em `kernelpanic-backend/src/exportacao/pdf.ts`.

**Escopo:** SCRUM-52. O uso em cada relatório fica nas tasks de exportação (SCRUM-56, SCRUM-62 e SCRUM-68).

## Opções comparadas

| Critério | pdfmake (backend) | Puppeteer (backend) | @react-pdf/renderer (frontend) | jsPDF (frontend) |
| --- | --- | --- | --- | --- |
| Gráficos | SVG vetorial nativo (`{ svg }`), gerado no servidor | Qualquer gráfico HTML/JS, renderizado num Chrome | Primitivas SVG próprias: o gráfico do dashboard teria que ser redesenhado | Desenho manual ou imagem rasterizada do canvas |
| Cabeçalho institucional, rodapé e paginação | `header`/`footer` com "Página X de Y" prontos; tabela repete o cabeçalho ao quebrar página | CSS de impressão; "Página X de Y" só pelo template de cabeçalho/rodapé do Chrome | Componentes `fixed` com número de página | Feito à mão (ou plugin autotable) |
| Peso | ~35 MB em `node_modules` da API, sem binário nativo; zero no bundle do navegador | Baixa um Chromium (centenas de MB) e precisa das libs do sistema no container; um processo de navegador por exportação | Centenas de KB a mais no bundle do Next | Menor que o react-pdf, ainda soma ao bundle |
| Reuso nos 3 relatórios | Uma função (`montarRelatorioPdf`) usada pelos três controllers | Template HTML compartilhado | Componente compartilhado | Função compartilhada |
| Auditoria da exportação (exigida nas tasks de exportação) | Mesmo request registra em `AuditoriaService.registrar`, como já faz `GET /auditoria/exportar` | Idem | Precisa de uma chamada extra só para registrar; o arquivo nasce fora da API | Idem |
| Mesmos números da tela | Dados vêm da mesma consulta agregada no banco da rota do relatório | Idem | Depende do que a tela tem em memória (a tela da SCRUM-55 lê até 5000 leituras por estação via `/dashboard`) | Idem |

## Por que pdfmake

- **Auditoria e consistência.** A exportação passa pela API: o mesmo endpoint que agrega no banco gera o arquivo e registra a exportação, sem depender do estado da tela. O CSV já segue esse padrão (`src/exportacao/csv.ts`).
- **Leve para operar.** Sem navegador headless no container nem processo extra por requisição, o que importa para a instalação dedicada por prefeitura (RNF23) e para o health check (RNF28).
- **Gráfico vetorial.** O gráfico entra como SVG, nítido na impressão e sem depender de canvas.
- **Bundle do frontend intacto.** A tela só baixa o arquivo.

Custo aceito: o gráfico do PDF é desenhado pelo backend (`graficoLinhasSvg`), separado do gráfico da tela. Os dois leem os mesmos dados, mas o visual pode divergir em detalhes.

## Layout base

`montarRelatorioPdf(opcoes)` devolve a definição do documento com:

- **Cabeçalho** em todas as páginas: "DATA PANIC", descrição do sistema e a licitação/órgão (`instituicao`), com filete na cor da marca.
- **Título** e subtítulo opcional.
- **Filtros usados**: tabela rótulo/valor, para o PDF dizer de onde vieram os números.
- **Conteúdo** do relatório (`conteudo`), montado com os auxiliares:
  - `secaoPdf(texto)`: título de seção; se cair no pé da página, passa para a seguinte junto com o conteúdo;
  - `tabelaPdf(cabecalhos, linhas, { larguras, colunasNumero, linhasTotal })`: cabeçalho repetido a cada página, linhas zebradas, números em pt-BR alinhados à direita, totalizadores em negrito;
  - `graficoLinhasSvg(series)`: gráfico de linhas com grade, eixo X (até 8 rótulos) e legenda.
- **Rodapé** em todas as páginas: "Emitido em dd/mm/aaaa, hh:mm (horário de Brasília) por <usuário>" e "Página X de Y".

Para responder, `enviarPdf(resposta, nomeArquivo, documento)` gera o arquivo inteiro antes de enviar (um erro ainda sai como JSON) e manda `Content-Type: application/pdf`, `Content-Disposition: attachment` e `Cache-Control: no-store`.

O pdfmake roda com acesso a URL bloqueado e leitura de arquivo restrita às fontes Roboto do próprio pacote: o PDF só usa dados passados pela API.

Esboço do uso numa rota de exportação:

```ts
@Get('historico-climatico/pdf')
async exportarPdf(@Query() query, @UsuarioAutenticado() usuario, @Res() resposta: Response) {
  const relatorio = await this.relatoriosService.historicoClimatico(query, usuario);
  await this.auditoriaService.registrar({ acao: 'relatorio.historico-climatico.exportar-pdf', ... });
  await enviarPdf(resposta, 'historico-climatico.pdf', montarRelatorioPdf({
    titulo: 'Relatório de histórico climático',
    instituicao: licitacao?.codigoIdentificador, // buscada pelo usuario.licitacaoId
    filtros: [{ rotulo: 'Período', valor: '...' }, ...],
    conteudo: [{ svg: graficoLinhasSvg(series) }, tabelaPdf(cabecalhos, linhas, { colunasNumero: [...] })],
    emitidoPor: nomeDoUsuario, // UsuarioLogado só traz id/e-mail
  }));
}
```

## Exemplo

[`exemplos/relatorio-pdf-exemplo.pdf`](exemplos/relatorio-pdf-exemplo.pdf), com dados fictícios: cabeçalho, filtros, gráfico, tabela que quebra de página com o cabeçalho repetido, totalizadores, rodapé e paginação. Para gerar de novo:

```bash
cd kernelpanic-backend
npm run pdf:exemplo
```
