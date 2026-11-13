import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useT } from '../lib/useT';

export default function NotFound() {
  const t = useT();
  return (
    <main className="scr plain">
      <Link className="back" to="/">
        <Icon name="back" size={20} />
        {t('knapp.tillbaka')}
      </Link>
      <h1>{t('allmant.saknas')}</h1>
    </main>
  );
}
