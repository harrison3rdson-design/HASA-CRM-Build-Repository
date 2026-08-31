import type { ReactNode } from 'react';
import '../styles/app.css';

export const metadata = {
  title: 'HASA Concepts Management',
  description: 'HASA Concepts, LLC management system',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
