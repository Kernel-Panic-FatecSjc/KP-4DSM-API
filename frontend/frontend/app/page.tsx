import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background p-8 text-center">
      <div className="grid size-12 place-items-center rounded-[8px] bg-lime font-display text-lg font-bold text-lime-foreground">
        K
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">KP-4DSM</h1>
        <p className="mt-1 text-sm text-muted-foreground">Painel de monitoramento e alertas de estações meteorológicas.</p>
      </div>
      <Link href="/login">
        <Button>Entrar</Button>
      </Link>
    </main>
  );
}
