import type { ReactNode } from 'react';

/** En flik utan innehåll än: rubrik och ett tomt läge. */
export function EmptyScreen({ title, empty, children }: { title: string; empty: string; children?: ReactNode }) {
  return (
    <main className="scr">
      <h1>{title}</h1>
      <div className="card soft">
        <p>{empty}</p>
      </div>
      {children}
    </main>
  );
}
