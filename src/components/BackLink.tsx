import type { MouseEvent, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { canGoBack } from '../lib/navMemory';
import { useT } from '../lib/useT';
import { Icon } from './Icon';

/**
 * Appens tillbakaknapp. Finns en föregående sida i appen går den bakåt i historiken som webbläsarens
 * bakåtknapp, så att listan står kvar där man var. Annars (öppnad direkt via länk) går den till `to`.
 */
export function BackLink({ to, children }: { to: string; children?: ReactNode }) {
  const t = useT();
  const nav = useNavigate();
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || !canGoBack()) return;
    e.preventDefault();
    nav(-1);
  };
  return (
    <Link className="back" to={to} onClick={onClick}>
      <Icon name="back" size={20} />
      {children ?? t('knapp.tillbaka')}
    </Link>
  );
}
