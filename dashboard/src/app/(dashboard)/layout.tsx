'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nav } from '@/components/Nav';
import { getToken, isTokenValid } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isTokenValid(getToken())) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
