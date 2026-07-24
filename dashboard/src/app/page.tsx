'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, isTokenValid } from '@/lib/auth';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isTokenValid(getToken()) ? '/registrants' : '/login');
  }, [router]);

  return null;
}
