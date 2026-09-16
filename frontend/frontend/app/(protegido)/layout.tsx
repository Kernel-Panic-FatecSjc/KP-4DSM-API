import { AppShell } from '@/components/AppShell';
import { ProtectedLayout } from '@/components/ProtectedLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <AppShell>{children}</AppShell>
    </ProtectedLayout>
  );
}
