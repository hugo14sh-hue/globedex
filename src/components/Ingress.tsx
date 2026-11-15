// Kort text i dämpad färg under flikens rubrik (ingress.karta, ingress.idag ...). Högst två rader på 390 px.
import { useSession } from '../lib/session';
import { useT } from '../lib/useT';

export function Ingress({ k }: { k: string }) {
  const t = useT();
  return <p className="ingress">{t(k)}</p>;
}

/** Ingressen för sista fliken: Jag (solo), Vi, eller Gruppen när gruppen har fler än två medlemmar. */
export function useLastTabIngress(): string {
  const { profile, members } = useSession();
  const mode = profile?.travel_mode ?? 'solo';
  if (mode === 'solo') return 'ingress.jag';
  return members.length > 2 ? 'ingress.gruppen' : 'ingress.vi';
}
