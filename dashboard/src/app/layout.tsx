import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RabtaLink Agent Dashboard',
  description: 'Internal dashboard for RabtaLink Rabta Agents',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
