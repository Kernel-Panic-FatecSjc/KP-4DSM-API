import { ProtectedLayout } from '@/components/ProtectedLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
