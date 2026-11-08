import type { ReactNode } from 'react';
import SiteFooter from './site-footer';
import SiteHeader from './site-header';

export default function AuthPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="page-shell flex min-h-[65vh] flex-col items-center justify-center py-12"
      >
        <div className="mb-7 max-w-md text-center">
          <h1 className="text-3xl font-bold tracking-tight text-brand-ink">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-brand-ink/70">{description}</p>
        </div>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
