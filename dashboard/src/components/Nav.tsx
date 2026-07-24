'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/auth';

const LINKS = [
  { href: '/registrants', label: 'Registrants' },
  { href: '/matches', label: 'Match Tracker' },
  { href: '/matches/propose', label: 'Propose a Match' },
  { href: '/rewards', label: 'Reward Ledger' },
  { href: '/demo', label: 'Demo Screen' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-border bg-paper-raised">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <span className="font-semibold text-ink">RabtaLink · Agent Dashboard</span>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                pathname === link.href ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => {
              clearToken();
              router.replace('/login');
            }}
            className="ml-2 rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
