import type { Metadata } from 'next';
import './globals.css';
import Providers from './components/Providers';

export const metadata: Metadata = {
  title: 'ExpenseFlow — Track every pound. Know where it goes.',
  description:
    'A production-grade expense tracker built with React, Node.js, MongoDB, Redis, and GraphQL. Features AI receipt scanning, multi-currency support, shared group expenses, analytics, and more.',
  openGraph: {
    title: 'ExpenseFlow',
    description: 'Track every pound. Know where it goes.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#0f1117] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
