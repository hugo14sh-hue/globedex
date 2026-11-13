import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { useT } from '../lib/useT';
import { useTravelMode } from '../lib/session';
import { useFeedback } from './Feedback';

const LAST_TAB = { solo: 'flik.jag', par: 'flik.vi', grupp: 'flik.gruppen' } as const;

/** Fem flikar längst ned. Sista fliken heter Jag, Vi eller Gruppen efter reseläget. */
export function AppShell() {
  const t = useT();
  const mode = useTravelMode();
  const { toast } = useFeedback();

  useEffect(() => {
    const off = () => toast(t('allmant.offline'));
    const on = () => toast(t('allmant.online-igen'));
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    if (!navigator.onLine) off();
    return () => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    };
  }, [t, toast]);

  const tabs: [string, string, IconName][] = [
    ['/karta', t('flik.karta'), 'map'],
    ['/idag', t('flik.idag'), 'star'],
    ['/listor', t('flik.listor'), 'book'],
    ['/resor', t('flik.resor'), 'plane'],
    ['/vi', t(LAST_TAB[mode]), 'us'],
  ];

  return (
    <div className="app">
      <Outlet />
      <nav className="nav">
        {tabs.map(([to, label, icon]) => (
          <NavLink key={to} to={to}>
            <Icon name={icon} size={24} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export { LAST_TAB };
