// Välj plats i Idag: hemma, sparade platser, enhetens position eller en egen plats.
// Positionen frågas bara efter när användaren trycker på valet. Nekas den visas idag.position-nekad.
import { useId, useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Icon } from '../../components/Icon';
import type { Place } from '../../lib/content';
import type { SavedLocation } from '../../lib/idag';
import type { Spot } from '../../lib/idagLogic';
import { useT } from '../../lib/useT';

/** Egen plats ur ett namn: känns namnet igen i innehållet följer koordinaterna med. */
export function spotFromName(name: string, places: Place[]): Pick<Spot, 'name' | 'lat' | 'lon'> {
  const n = name.trim().toLocaleLowerCase('sv');
  const p = places.find((x) => x.name.toLocaleLowerCase('sv') === n && x.lat != null && x.lon != null);
  return { name: name.trim(), lat: p?.lat ?? null, lon: p?.lon ?? null };
}

export function LocationSheet({
  open,
  onClose,
  current,
  home,
  saved,
  places,
  onPick,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  current: Spot | null;
  home: SavedLocation | null;
  saved: SavedLocation[];
  places: Place[];
  onPick: (spot: Spot) => void;
  onAdd: (name: string) => Promise<void>;
  onRemove: (loc: SavedLocation) => Promise<void>;
}) {
  const t = useT();
  const listId = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const picked = (kind: Spot['kind'], id?: string) => current?.kind === kind && (id === undefined || current.id === id);

  const usePosition = () => {
    setError('');
    if (!('geolocation' in navigator)) {
      setError(t('idag.position-nekad'));
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        onPick({ kind: 'position', name: '', lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setBusy(false);
        setError(err.code === err.PERMISSION_DENIED ? t('idag.position-nekad') : t('allmant.fel'));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const pickOwn = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onPick({ kind: 'egen', ...spotFromName(name, places) });
    setName('');
  };

  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onAdd(name.trim());
      setName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} title={t('idag.plats.valj')} onClose={onClose}>
      {home && (
        <button type="button" className={`li${picked('hemma') ? ' picked' : ''}`} aria-pressed={picked('hemma')} onClick={() => onPick({ kind: 'hemma', name: home.name, lat: home.lat, lon: home.lon, id: home.id })}>
          <span className="badge">
            <Icon name="build" size={20} />
          </span>
          <span className="t">
            <b>{home.name}</b>
            <span className="mu">{t('idag.plats.hemma')}</span>
          </span>
        </button>
      )}

      <button type="button" className={`li${picked('position') ? ' picked' : ''}`} aria-pressed={picked('position')} disabled={busy} onClick={usePosition}>
        <span className="badge">
          <Icon name="locate" size={20} />
        </span>
        <span className="t">
          <b>{t('idag.plats.position')}</b>
        </span>
      </button>
      {error && (
        <p className="mu" role="alert">
          {error}
        </p>
      )}

      {saved.length > 0 && (
        <>
          <h3 className="eb">{t('idag.plats.sparad')}</h3>
          {saved.map((s) => (
            <div key={s.id} className={`li${picked('sparad', s.id) ? ' picked' : ''}`}>
              <button
                type="button"
                className="t"
                aria-pressed={picked('sparad', s.id)}
                onClick={() => onPick({ kind: 'sparad', name: s.name, lat: s.lat, lon: s.lon, id: s.id })}
              >
                <b>{s.name}</b>
              </button>
              <button type="button" className="mini" aria-label={`${t('knapp.ta-bort')}: ${s.name}`} onClick={() => void onRemove(s)}>
                <Icon name="x" size={18} />
              </button>
            </div>
          ))}
        </>
      )}

      <form className="col" onSubmit={pickOwn}>
        <label>
          {t('idag.plats.egen')}
          <input value={name} maxLength={60} list={listId} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          <datalist id={listId}>
            {places
              .filter((p) => p.lat != null && p.lon != null)
              .map((p) => (
                <option key={p.id} value={p.name} />
              ))}
          </datalist>
        </label>
        <div className="g2">
          <button type="submit" className="btn" disabled={!name.trim()}>
            {t('knapp.valj')}
          </button>
          <button type="button" className="btn ghost" disabled={!name.trim() || busy} onClick={() => void add()}>
            <Icon name="plus" size={20} />
            {t('idag.plats.ny')}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
