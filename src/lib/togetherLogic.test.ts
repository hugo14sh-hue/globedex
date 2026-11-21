import { describe, expect, it } from 'vitest';
import {
  allowsTogether,
  defaultTripGroup,
  filterTrips,
  isPersonView,
  isSoloTrip,
  myMap,
  ourMap,
  ourVisited,
  personStatuses,
  showTripFilter,
  togetherFor,
  togetherPlaces,
  toRows,
  viewStatuses,
  type StatusRow,
} from './togetherLogic';

const G = 'grupp-1';
const ANNAN = 'grupp-2';
const row = (user_id: string, place_id: string, status: StatusRow['status'], together_group: string | null = null, updated_at: string | null = null): StatusRow => ({
  user_id,
  place_id,
  status,
  together_group,
  updated_at,
});

describe('regeln för tillsammans', () => {
  it('en medlem räcker: den andra behöver inte markera samma sak', () => {
    const rows = [row('jag', 'IT', 'besokt', G), row('du', 'IT', 'vill')];
    expect([...togetherPlaces(rows, G)]).toEqual(['IT']);
  });

  it('räknar bara gruppens eget id, inte en annan grupps', () => {
    expect(togetherPlaces([row('jag', 'FR', 'besokt', ANNAN)], G).size).toBe(0);
  });

  it('bor och har bott räknas, mellanlandat och vill åka gör det inte', () => {
    const rows = [row('jag', 'SE', 'bor', G), row('jag', 'NO', 'bott', G), row('jag', 'DK', 'mellan', G), row('jag', 'FI', 'vill', G)];
    expect([...togetherPlaces(rows, G)].sort()).toEqual(['NO', 'SE']);
  });

  it('räknar bara gruppens nuvarande medlemmar när de anges', () => {
    expect(togetherPlaces([row('gammal', 'ES', 'besokt', G)], G, ['jag', 'du']).size).toBe(0);
  });
});

describe('together_group nollställs för vill åka och planerad', () => {
  it('vill åka, planerad och ingen status ger alltid tomt', () => {
    expect(togetherFor('vill', G)).toBeNull();
    expect(togetherFor('planerad', G, G)).toBeNull();
    expect(togetherFor(null, G)).toBeNull();
    expect(allowsTogether('vill')).toBe(false);
    expect(allowsTogether('planerad')).toBe(false);
  });

  it('besökt, bor, har bott och mellanlandat sparar valet', () => {
    for (const s of ['besokt', 'bor', 'bott', 'mellan'] as const) {
      expect(allowsTogether(s)).toBe(true);
      expect(togetherFor(s, G)).toBe(G);
      expect(togetherFor(s, null, G)).toBeNull();
    }
  });

  it('utan nytt val ligger det tidigare kvar (byte från besökt till bor)', () => {
    expect(togetherFor('bor', undefined, G)).toBe(G);
    expect(togetherFor('besokt', undefined, null)).toBeNull();
  });

  it('läser rader från databasen och hoppar över okända statusar', () => {
    expect(
      toRows([
        { user_id: 'jag', place_id: 'IT', status: 'besokt', together_group: G },
        { user_id: 'jag', place_id: 'FR', status: 'okand' },
      ]),
    ).toEqual([row('jag', 'IT', 'besokt', G)]);
  });
});

describe('Vår karta: ordningen a till d', () => {
  const members = ['jag', 'du'];

  it('a. tillsammans går före allt annat, även när båda har besökt', () => {
    const rows = [row('jag', 'IT', 'besokt'), row('du', 'IT', 'besokt', G)];
    expect(ourVisited(rows, 'jag', members, G).IT.key).toBe('tillsammans');
  });

  it('b. båda, var för sig: alla har besökt men ingen har markerat tillsammans', () => {
    const rows = [row('jag', 'FR', 'besokt'), row('du', 'FR', 'bott')];
    expect(ourVisited(rows, 'jag', members, G).FR.key).toBe('bada');
  });

  it('c. bara jag', () => {
    expect(ourVisited([row('jag', 'ES', 'besokt'), row('du', 'ES', 'vill')], 'jag', members, G).ES).toEqual({ key: 'bara-jag', others: [] });
  });

  it('d. bara den andra, med namnet (id) för platsens ruta', () => {
    expect(ourVisited([row('du', 'PT', 'bor')], 'jag', members, G).PT).toEqual({ key: 'bara-annan', others: ['du'] });
  });

  it('en grupp med fler än två: en gemensam färg för de andra, och alla måste ha besökt för båda', () => {
    const three = ['jag', 'du', 'hen'];
    const rows = [row('du', 'GR', 'besokt'), row('hen', 'GR', 'besokt'), row('jag', 'HR', 'besokt'), row('du', 'HR', 'besokt')];
    const v = ourVisited(rows, 'jag', three, G);
    expect(v.GR).toEqual({ key: 'bara-annan', others: ['du', 'hen'] });
    expect(v.HR.key).toBe('bara-annan');
    expect(ourVisited([...rows, row('hen', 'HR', 'bott')], 'jag', three, G).HR.key).toBe('bada');
  });

  it('en grupp med bara en medlem ger bara jag, inte båda', () => {
    expect(ourVisited([row('jag', 'IS', 'besokt')], 'jag', ['jag'], G).IS.key).toBe('bara-jag');
  });

  it('vill åka, planerad och mellanlandat visas som förut (högsta status)', () => {
    const rows = [row('jag', 'JP', 'vill'), row('du', 'JP', 'planerad'), row('du', 'TH', 'mellan'), row('jag', 'IT', 'besokt', G)];
    expect(ourMap(rows, 'jag', members, G)).toEqual({ JP: 'planerad', TH: 'mellan', IT: 'tillsammans' });
  });
});

describe('Min karta med och utan together_group', () => {
  const statuses = { IT: 'besokt', FR: 'besokt', SE: 'bor', JP: 'vill', DK: 'mellan' } as const;
  const together = { IT: G, SE: G, DK: G };

  it('med sällskap: tillsammans får sin färg, på egen hand behåller färgen för besökt', () => {
    expect(myMap(statuses, together, true)).toEqual({ IT: 'tillsammans', FR: 'besokt', SE: 'tillsammans', JP: 'vill', DK: 'mellan' });
  });

  it('utan par- eller gruppgrupp ser kartan ut som förut', () => {
    expect(myMap(statuses, together, false)).toEqual(statuses);
  });

  it('utan together_group är allt som förut', () => {
    expect(myMap(statuses, {}, true)).toEqual(statuses);
  });
});

describe('de fyra lägena i Vi', () => {
  const members = ['jag', 'du'];
  const rows = [
    row('jag', 'IT', 'besokt', G, '2026-03-01'),
    row('du', 'IT', 'besokt', null, '2026-02-01'),
    row('jag', 'FR', 'besokt', null, '2026-01-01'),
    row('du', 'ES', 'bor', G, '2026-04-01'),
    row('du', 'NO', 'vill'),
    row('jag', 'DK', 'mellan', G),
  ];
  const ids = (v: string) =>
    viewStatuses(v, rows, 'jag', members, G)
      .map((s) => `${s.place_id}:${s.status}`)
      .sort();

  it('tillsammans: bara platser besökta tillsammans, en medlem räcker', () => {
    expect(ids('tillsammans')).toEqual(['ES:besokt', 'IT:besokt']);
    // Datumet är när platsen först markerades tillsammans.
    expect(viewStatuses('tillsammans', rows, 'jag', members, G).find((s) => s.place_id === 'IT')?.updated_at).toBe('2026-03-01');
  });

  it('någon av oss: allt som minst en har markerat, med högsta status', () => {
    expect(ids('nagon')).toEqual(['DK:mellan', 'ES:bor', 'FR:besokt', 'IT:besokt', 'NO:vill']);
  });

  it('jag: mina rader plus det den andra har markerat som tillsammans', () => {
    expect(ids('jag')).toEqual(['DK:mellan', 'ES:bor', 'FR:besokt', 'IT:besokt']);
  });

  it('den andra: den personens rader plus det jag har markerat som tillsammans, och en okänd person ger inget', () => {
    expect(ids('du')).toEqual(['DK:mellan', 'ES:bor', 'IT:besokt', 'NO:vill']);
    expect(ids('okand')).toEqual([]);
  });

  it('personens lägen och gruppens lägen', () => {
    expect(isPersonView('jag')).toBe(true);
    expect(isPersonView('du')).toBe(true);
    expect(isPersonView('tillsammans')).toBe(false);
    expect(isPersonView('nagon')).toBe(false);
  });
});

describe('en persons platser (Körning 22)', () => {
  const members = ['jag', 'du'];
  const ids = (rows: StatusRow[], person = 'jag') =>
    personStatuses(person, rows, members, G)
      .map((s) => `${s.place_id}:${s.status}`)
      .sort();

  it('egen rad räknas, med eller utan tillsammans', () => {
    expect(ids([row('jag', 'FR', 'besokt'), row('jag', 'IT', 'besokt', G), row('jag', 'NO', 'vill')])).toEqual(['FR:besokt', 'IT:besokt', 'NO:vill']);
  });

  it('en annans rad med tillsammans räknas med samma status', () => {
    expect(ids([row('du', 'ES', 'bor', G), row('du', 'PT', 'bott', G), row('du', 'DK', 'mellan', G), row('du', 'IT', 'besokt', G)])).toEqual([
      'DK:mellan',
      'ES:bor',
      'IT:besokt',
      'PT:bott',
    ]);
  });

  it('en annans rad utan tillsammans räknas inte, inte heller tillsammans med en annan grupp', () => {
    expect(ids([row('du', 'FR', 'besokt'), row('du', 'DE', 'besokt', ANNAN)])).toEqual([]);
  });

  it('en rad från någon som inte är medlem räknas inte', () => {
    expect(ids([row('gammal', 'FR', 'besokt', G)])).toEqual([]);
  });

  it('högsta status vinner', () => {
    expect(ids([row('jag', 'IT', 'mellan'), row('du', 'IT', 'besokt', G)])).toEqual(['IT:besokt']);
    expect(ids([row('jag', 'SE', 'bor'), row('du', 'SE', 'besokt', G)])).toEqual(['SE:bor']);
    expect(ids([row('jag', 'NO', 'vill'), row('du', 'NO', 'besokt', G)])).toEqual(['NO:besokt']);
  });

  it('vill åka och planerad följer aldrig med från någon annan', () => {
    expect(ids([row('du', 'JP', 'vill', G), row('du', 'TH', 'planerad', G)])).toEqual([]);
  });

  it('datumet följer raden med den högsta statusen, vid lika status det tidigaste', () => {
    const rows = [row('jag', 'IT', 'mellan', null, '2026-01-01'), row('du', 'IT', 'besokt', G, '2026-05-01'), row('du', 'FR', 'besokt', G, '2026-04-01'), row('jag', 'FR', 'besokt', G, '2026-03-01')];
    const by = Object.fromEntries(personStatuses('jag', rows, members, G).map((s) => [s.place_id, s.updated_at]));
    expect(by).toEqual({ IT: '2026-05-01', FR: '2026-03-01' });
  });

  it('samma regel åt båda håll: den andra får det jag har markerat som tillsammans', () => {
    expect(ids([row('jag', 'IT', 'besokt', G)], 'du')).toEqual(['IT:besokt']);
  });
});

describe('resor: vem reser och filtret', () => {
  const groups = [
    { id: 'solo', kind: 'solo' as const },
    { id: 'par', kind: 'par' as const },
    { id: 'gang', kind: 'grupp' as const },
  ];
  const trips = [
    { id: 'a', group_id: 'solo' },
    { id: 'b', group_id: 'par' },
    { id: 'c', group_id: 'gang' },
    { id: 'd', group_id: 'par' },
  ];
  const ids = (f: string) => filterTrips(trips, f, groups).map((t) => t.id);

  it('alla, soloresor och en grupp', () => {
    expect(ids('alla')).toEqual(['a', 'b', 'c', 'd']);
    expect(ids('solo')).toEqual(['a']);
    expect(ids('par')).toEqual(['b', 'd']);
    expect(ids('gang')).toEqual(['c']);
  });

  it('ett okänt filter (en grupp man har lämnat) visar alla', () => {
    expect(ids('borta')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filtret visas vid resor i mer än en grupp eller med en par- eller gruppgrupp', () => {
    expect(showTripFilter([{ group_id: 'solo' }], [groups[0]])).toBe(false);
    expect(showTripFilter([], [groups[0]])).toBe(false);
    expect(showTripFilter([{ group_id: 'solo' }, { group_id: 'x' }], [groups[0]])).toBe(true);
    expect(showTripFilter([], groups)).toBe(true);
  });

  it('soloresor känns igen på gruppens typ', () => {
    expect(isSoloTrip(trips[0], groups)).toBe(true);
    expect(isSoloTrip(trips[1], groups)).toBe(false);
  });

  it('förvalet är gruppen som är vald i appen, annars sologruppen', () => {
    expect(defaultTripGroup('par', 'solo', ['solo', 'par'])).toBe('par');
    expect(defaultTripGroup('okand', 'solo', ['solo', 'par'])).toBe('solo');
    expect(defaultTripGroup(null, null, ['par'])).toBe('par');
  });
});
