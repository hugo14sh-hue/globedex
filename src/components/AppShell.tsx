import { Suspense, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { useT } from '../lib/useT';
import { useSession, useTravelMode } from '../lib/session';
import { useOfflineWarmup } from '../lib/offlineWarmup';
import { useFeedback } from './Feedback';
import { Loading } from './Loading';

const LAST_TAB = { solo: 'flik.jag', par: 'flik.vi', grupp: 'flik.gruppen' } as const;

/**
 * Sex flikar längst ned. Sista fliken heter Jag, Vi eller Gruppen efter reseläget.
 * Upptäck (Körning 15) står direkt efter Karta. Flikarna delar bredden lika (63 px var på 390 px) och
 * etiketten bryts inte: får den inte plats krymper den med ellips, så att raden aldrig blir bredare än skärmen.
 */
export function AppShell() {
  const t = useT();
  const mode = useTravelMode();
  const { toast } = useFeedback();
  const { activeGroup } = useSession();
  // Kommande resors bokningar och packlista sparas för läsning utan uppkoppling.
  useOfflineWarmup(activeGroup?.id);

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
    ['/upptack', t('flik.upptack'), 'compass'],
    ['/idag', t('flik.idag'), 'star'],
    ['/listor', t('flik.listor'), 'book'],
    ['/resor', t('flik.resor'), 'plane'],
    ['/vi', t(LAST_TAB[mode]), 'us'],
  ];

  return (
    <div className="app">
      {/* Fliken laddas för sig: navigeringen längst ned står kvar medan den hämtas. */}
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
      <nav className="nav">
        {tabs.map(([to, label, icon]) => (
          <NavLink key={to} to={to}>
            <Icon name={icon} size={24} />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export { LAST_TAB };
