import type { ReactNode } from 'react';

export function Card({ children, soft, className = '' }: { children: ReactNode; soft?: boolean; className?: string }) {
  return <div className={`card${soft ? ' soft' : ''} ${className}`.trim()}>{children}</div>;
}
