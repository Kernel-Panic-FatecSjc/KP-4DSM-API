# Frontend Structure Analysis

## 🔴 CRÍTICO - Duplicação

### 1. Duas páginas de Alertas
- **`/alarmes`** (577 linhas, Tailwind, API real) ✅ Nova
- **`/alertas`** (511 linhas, CSS modules, dados mock) ❌ Antiga

**Impacto:** Confusão, manutenção duplicada, inconsistência
**Solução:** Manter `/alarmes`, deletar `/alertas`

---

### 2. Duas páginas de Usuários  
- **`/usuarios`** (182 linhas) - Criar usuário, lista simples
- **`/usuarios/listar`** (454 linhas) - Lista com filtros/paginação

**Impacto:** Lógica dividida, URLs confusas
**Solução:** Unificar em `/usuarios` com abas ou remover `/usuarios/listar`

---

### 3. CSS Modules vs Tailwind (Inconsistência de Design)
- **CSS modules (antigo):** `alertas/App.module.css`, `estacoes/App.module.css`
- **Tailwind (novo):** alarmes, usuarios, usuários/listar, alerta-log, dashboard

**Impacto:** Manutenção duplicada, bundle maior, estilos inconsistentes
**Solução:** Migrar `alertas` e `estacoes` para Tailwind

---

## 🟡 PADRÕES REPETIDOS (Oportunidades de Hooks)

### Pattern: Fetch + Filtro + Paginação
Usado em: `alarmes`, `alertas`, `estacoes`, `usuarios/listar`, `alerta-log`

```typescript
// Padrão atual (repetido 5 vezes)
const [data, setData] = useState<T[] | null>(null);
const [erro, setErro] = useState<string | null>(null);
const [filtros, setFiltros] = useState<Filtro>({ pagina: 1 });
const [carregando, setCarregando] = useState(false);

const carregar = useCallback(async () => {
  try {
    setCarregando(true);
    const result = await api('/endpoint?filtros');
    setData(result);
  } catch (e) {
    setErro(e.message);
  } finally {
    setCarregando(false);
  }
}, [filtros]);

useEffect(() => {
  void carregar();
}, [carregar]);
```

**Solução Lazy:** 
```typescript
// hooks/useListaFiltrada.ts
export function useListaFiltrada<T>(
  endpoint: string,
  initialFiltros: Filtros
) {
  const [data, setData] = useState<T[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtros, setFiltros] = useState(initialFiltros);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => { /* ... */ }, [filtros]);
  useEffect(() => { void carregar(); }, [carregar]);

  return { data, erro, filtros, setFiltros, carregando, refetch: carregar };
}
```

**Economia:** ~250 linhas de código (cada página fica 30-50 linhas menor)

---

### Pattern: Construção de Query String
Usado em: alarmes, alertas (dois `montarQuery` quase idênticos)

```typescript
// Padrão atual (repetido)
function montarQuery(filtros: Filtros): string {
  const params = new URLSearchParams();
  if (filtros.id) params.set('id', filtros.id);
  if (filtros.nome) params.set('nome', filtros.nome);
  return params.toString();
}
```

**Solução:** Helper único em `lib/query.ts`

---

### Pattern: Componentes de Tabela
Cada página implementa seu próprio:
- Header com colunas
- Rows com dados
- Paginação
- Skeleton loader

**Solução:** Componente `<DataTable>` genérico

```typescript
<DataTable
  columns={[
    { header: 'Nome', key: 'nome' },
    { header: 'Email', key: 'email' },
  ]}
  data={usuarios}
  onPageChange={setPage}
  currentPage={page}
/>
```

**Economia:** ~200 linhas

---

## 🟠 ESTRUTURA

### Faltam Diretórios
```
components/
  ui/              ✅ inputs, buttons
  tables/          ❌ FALTA: genérico DataTable, StatusBadge
  forms/           ❌ FALTA: FormField, form wrappers
  filters/         ❌ FALTA: FilterPanel, DateRange
  loaders/         ❌ FALTA: Skeleton components
```

### lib/ Desorganizada
```
lib/
  api.ts           ✅ cliente HTTP
  utils.ts         ✅ cn() helper
  query.ts         ❌ FALTA: query builders
  validators.ts    ❌ FALTA: form validation
  hooks.ts         ❌ FALTA: reusable hooks
```

---

## 📊 Detalhes por Página

| Página | Linhas | Status | Padrão | Problema |
|--------|--------|--------|---------|----------|
| dashboard | 164 | ✅ Novo | Tailwind | Muito simplificado |
| alarmes | 577 | ✅ Novo | Tailwind | Grande, lógica mista |
| alertas | 511 | ❌ Antigo | CSS modules | **DELETE** |
| estacoes | 743 | 🟡 Misto | CSS modules | Migrar pra Tailwind |
| usuarios | 182 | ✅ Novo | Tailwind | Pequeno, simples |
| usuarios/listar | 454 | ✅ Novo | Tailwind | Duplica usuarios |
| alerta-log | 841 | ✅ Novo | Inline styles | Custom, OK |

---

## 🔧 Prioridade de Melhorias

### Tier 1 (Agora)
1. **Delete `/alertas`** - duplicação clara
2. **Create `useListaFiltrada` hook** - remove ~250 linhas
3. **Create generic `<DataTable>`** - remove ~200 linhas

### Tier 2 (Depois)
1. Migrar CSS modules → Tailwind
2. Unificar pages de usuários
3. Extract form components

### Tier 3 (Futuro)
1. Form validation (zod)
2. Error boundaries
3. Loading states pattern

---

## Benefícios Esperados

| Ação | LOC Redução | Tempo | Dificuldade |
|------|------------|--------|-----------|
| Delete /alertas | -511 | 5min | Trivial |
| useListaFiltrada | -250 | 30min | Fácil |
| DataTable component | -200 | 45min | Médio |
| CSS → Tailwind | -400 | 1h | Médio |
| **Total** | **-1,361 LOC** | **~2h** | **Fácil-Médio** |

**Total atual:** 6,036 linhas → **4,675 linhas** (23% redução)

---

## Checklist

- [ ] Decidir se delete /alertas ou refatora
- [ ] Extrair useListaFiltrada
- [ ] Criar <DataTable> genérico
- [ ] Refatorar alarmes/alertas/estacoes/usuarios
- [ ] Migrar CSS modules para Tailwind
- [ ] Unificar usuários
