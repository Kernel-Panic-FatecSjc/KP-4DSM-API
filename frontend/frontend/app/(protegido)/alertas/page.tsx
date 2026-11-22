'use client';

import { redirect } from 'next/navigation';

// O CRUD de alertas pela API fica em /gerenciamento-de-alertas. O redirecionamento
// é no cliente para rodar só depois do ProtectedLayout: sem login, o visitante
// vai para /login?proximo=/alertas, como nas outras rotas privadas.
export default function AlertasPage() {
  redirect('/gerenciamento-de-alertas');
}
