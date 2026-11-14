import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

interface RowProps {
  title: string;
  sub?: string;
  icon?: IconName;
  /** Egen ruta till vänster i stället för ikonen, till exempel en färgad märkning. */
  lead?: ReactNode;
  right?: ReactNode;
  /** Liten märkning före pilen, till exempel prisnivån. */
  meta?: ReactNode;
  /** Länk till en undersida, eller en knapp som öppnar ett bottenark. */
  to?: string;
  onClick?: () => void;
}

/** En rad som öppnar en detaljvy. Blir en riktig länk eller knapp. */
export function Row({ title, sub, icon, lead, right, meta, to, onClick }: RowProps) {
  const inner = (
    <>
      {lead}
      {!lead && icon && (
        <span className="badge">
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="t">
        <b>{title}</b>
        {sub && <span className="mu">{sub}</span>}
      </span>
      {meta}
      {right ?? (
        <span className="chev">
          <Icon name="chev" size={18} />
        </span>
      )}
    </>
  );
  if (to)
    return (
      <Link className="li" to={to}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" className="li" onClick={onClick}>
        {inner}
      </button>
    );
  return <div className="li">{inner}</div>;
}
