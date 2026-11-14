import { Link } from 'react-router-dom';
import { Logo } from '../../components/Logo';
import { APP_NAME } from '../../config';
import { useSession } from '../../lib/session';
import { useT } from '../../lib/useT';

/** Smal list överst på Karta: märket och appens namn, och gruppens namn som leder till sista fliken. */
export function TopBar() {
  const t = useT();
  const { activeGroup } = useSession();
  return (
    <header className="topbar">
      <span className="brand">
        <Logo size={28} decorative />
        <span className="brand-name">{APP_NAME}</span>
      </span>
      {activeGroup && (
        <Link className="chip group-link" to="/vi" aria-label={t('topp.till-gruppen', { namn: activeGroup.name })}>
          {activeGroup.name}
        </Link>
      )}
    </header>
  );
}
