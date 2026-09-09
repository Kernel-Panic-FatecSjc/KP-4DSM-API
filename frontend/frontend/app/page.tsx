import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">KP-4DSM</h1>
      <Link href="/login" className="rounded bg-black px-4 py-2 text-white">
        Entrar
      </Link>
    </main>
  );
}
