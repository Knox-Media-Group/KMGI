import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Website Builder',
  description: 'Build your website with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
