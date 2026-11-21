import { describe, expect, it } from 'vitest';
import { BADGES } from '../../lib/texter';
import { badgeStates, emptyInput, type BadgeState, type TripLike, type ViInput } from './marken';
import { exportText, groupFinds, numbers, timeline, toastBadges, viewBadges, viewInput, wrapped, wrappedYears, type ViSource } from './viLogic';

const TODAY = '2026-11-13';
const input = (p: Partial<ViInput> = {}): ViInput => ({ ...emptyInput('solo', TODAY), ...p });
const trip = (id: string, p: Partial<TripLike> = {}): TripLike => ({
  id,
  title: id,
  place_id: 'NL-amsterdam',
  kind: 'resa',
  status: 'planerad',
  start_date: '2026-05-01',
  end_date: '2026-05-05',
  budget: {},
  created_at: '2026-01-01T00:00:00Z',
  ...p,
});

describe('siffror', () => {
  it('räknar länder, kontinenter, landskap, resor, dagar, fynd och bucket', () => {
    const x = input({
      statuses: [
        { place_id: 'SE', status: 'bor', updated_at: null },
        { place_id: 'US', status: 'besokt', updated_at: null },
        { place_id: 'DE', status: 'vill', updated_at: null },
        { place_id: 'SE-skane', status: 'besokt', updated_at: null },
      ],
      seRegions: ['SE-skane', 'SE-halland'],
      trips: [trip('a'), trip('b', { start_date: '2026-08-01', end_date: '2026-08-02' }), trip('c', { start_date: '2027-01-01', end_date: null })],
      finds: [{ compendium_id: 'x', found_on: '2026-01-01', place_id: null }],
      bucket: [
        { id: '1', catalog_id: null, title: 'A', done_on: '2026-01-01' },
        { id: '2', catalog_id: null, title: 'B', done_on: null },
      ],
    });
    const n = numbers(x, 40);
    expect(n.lander).toEqual(['SE', 'US']);
    expect(n.kontinenter).toEqual(['EU', 'NA']);
    expect(n.landskap).toEqual(['SE-skane']);
    expect(n.landskapTotalt).toBe(2);
    expect(n.resor.map((t) => t.id)).toEqual(['a', 'b']);
    expect(n.resdagar).toBe(7);
    expect([n.fynd, n.fyndTotalt, n.bucket]).toEqual([1, 40, 1]);
  });
});

describe('Wrapped', () => {
  const x = input({
    trips: [
      trip('kort', { place_id: 'NL-amsterdam', start_date: '2026-03-01', end_date: '2026-03-03' }),
      trip('lang', { place_id: 'DE', start_date: '2026-07-01', end_date: '2026-07-10' }),
      trip('utflykt', { kind: 'utflykt', place_id: 'SE', start_date: '2026-04-01', end_date: '2026-04-01' }),
      trip('framtid', { place_id: 'FR', start_date: '2026-12-20', end_date: '2026-12-24' }),
      trip('ifjol', { place_id: 'DK', start_date: '2025-06-01', end_date: '2025-06-03' }),
    ],
    finds: [
      { compendium_id: 'a', found_on: '2026-03-02', place_id: null },
      { compendium_id: 'b', found_on: '2025-03-02', place_id: null },
    ],
    bucket: [{ id: '1', catalog_id: null, title: 'A', done_on: '2026-07-05' }],
  });

  it('summerar året', () => {
    const w = wrapped(x, 2026)!;
    expect(w.trips).toBe(2);
    expect(w.countries).toEqual(['DE', 'NL']);
    expect(w.days).toBe(13);
    expect(w.finds).toBe(1);
    expect(w.bucket).toBe(1);
    expect(w.longest?.trip.id).toBe('lang');
    expect(w.longest?.days).toBe(10);
  });

  it('kräver minst en resa under året', () => {
    expect(wrapped(x, 2024)).toBeNull();
    expect(wrapped(input({ trips: [trip('u', { kind: 'utflykt' })] }), 2026)).toBeNull();
  });

  it('erbjuder år med resor och innevarande år', () => {
    expect(wrappedYears(x)).toEqual([2026, 2025]);
    expect(wrappedYears(input())).toEqual([2026]);
  });
});

describe('tidslinje', () => {
  it('blandar resor, fynd, märken och bucket, nyast först', () => {
    const x = input({
      statuses: [{ place_id: 'NL', status: 'besokt', updated_at: '2026-05-03T00:00:00Z' }],
      trips: [trip('Amsterdam'), trip('Senare', { start_date: '2027-01-01', end_date: null })],
      finds: [{ compendium_id: 'stroop', found_on: '2026-05-02', place_id: 'NL' }],
      bucket: [{ id: '1', catalog_id: null, title: 'Nyår', done_on: '2026-01-01' }],
    });
    const tl = timeline(x, badgeStates(BADGES, x), (id) => id.toUpperCase());
    expect(tl.map((e) => [e.type, e.date, e.title])).toEqual([
      ['marke', '2026-05-05', 'Vanresenären'],
      ['marke', '2026-05-03', 'Första stämpeln'],
      ['fynd', '2026-05-02', 'STROOP'],
      ['resa', '2026-05-01', 'Amsterdam'],
      // Samma dag: märken före bucketpunkten. En egen punkt ger också Egen dröm.
      ['marke', '2026-01-01', 'Egen dröm'],
      ['marke', '2026-01-01', 'Gjort är gjort'],
      ['bucket', '2026-01-01', 'Nyår'],
    ]);
    expect(tl.find((e) => e.title === 'Vanresenären')?.level).toBe(1);
  });
});

describe('export', () => {
  const d = {
    trips: [{ title: 'Amsterdam', place: 'Nederländerna', start: '2026-05-01', end: '2026-05-05', phase: 'Tidigare' }],
    statuses: [
      { label: 'Besökt', places: ['Nederländerna', 'Tyskland'] },
      { label: 'Vill åka', places: [] },
    ],
    lists: [{ label: 'Bucketlist', items: ['Norrsken'] }],
    reviews: [{ name: 'Pierogarnia', place: 'Polen', rating: 9, note: 'Ta de stekta.' }],
  };
  const h = (p: string) => p.toUpperCase();
  const r = (n: number) => `${n} av 10`;

  it('tar med valda delar och hoppar över tomma', () => {
    expect(exportText(d, ['resor', 'status', 'listor', 'omdomen'], h, r)).toBe(
      [
        'RESOR\n- Amsterdam, Nederländerna, 2026-05-01 – 2026-05-05, Tidigare',
        'STATUS\n- Besökt: Nederländerna, Tyskland',
        'LISTOR\n- Bucketlist: Norrsken',
        'OMDOMEN\n- Pierogarnia, Polen: 9 av 10. Ta de stekta.',
      ].join('\n\n'),
    );
    expect(exportText(d, ['omdomen'], h, r)).toBe('OMDOMEN\n- Pierogarnia, Polen: 9 av 10. Ta de stekta.');
    expect(exportText(d, [], h, r)).toBe('');
  });
});

// ---------- Vems siffror (Körning 22) ----------

describe('siffror, märken och tidslinje per person', () => {
  const G = 'g1';
  const members = ['hugo', 'emilia'];
  const par = (p: Partial<ViInput> = {}): ViInput => ({ ...emptyInput('par', TODAY), memberIds: members, ...p });
  const find = (compendium_id: string, found_on: string | null = '2026-03-01') => ({ compendium_id, found_on, place_id: null });
  const src = (p: Partial<ViSource> = {}): ViSource => ({
    statusRows: [],
    memberIds: members,
    groupId: G,
    findsByUser: {},
    checksByUser: {},
    reviews: [],
    customPaletteByUser: {},
    ...p,
  });
  // Hugos eget underlag: fem fynd, en sak i en samling och en rad i Valvet.
  const hugo = par({
    finds: ['a', 'b', 'c', 'd', 'e'].map((c) => find(c)),
    collectionEntries: [{ got_on: '2026-02-01' }],
    vault: [{ updated_at: '2026-02-01T00:00:00Z' }],
    customPalette: true,
  });
  const ids = (s: BadgeState[] | null) => (s ?? []).map((b) => b.badge.id);
  const earned = (s: BadgeState[] | null) => (s ?? []).filter((b) => b.earned).map((b) => b.badge.id);

  it('läget Jag räknar på den inloggades underlag', () => {
    expect(viewInput('jag', hugo, 'hugo', src())).toBe(hugo);
    expect(viewInput(null, hugo, 'hugo', src())).toBe(hugo);
    expect(earned(viewBadges('jag', BADGES, hugo))).toEqual(expect.arrayContaining(['marke-samlare', 'marke-valvet', 'marke-eget-tema']));
  });

  it('märken för en annan medlem räknas på den medlemmens fynd, inte den inloggades', () => {
    const s = src({ findsByUser: { hugo: hugo.finds, emilia: [find('x', '2026-06-01')] } });
    const x = viewInput('emilia', hugo, 'hugo', s);
    expect(x.finds.map((f) => f.compendium_id)).toEqual(['x']);
    const fynd = viewBadges('emilia', BADGES, x)!.find((b) => b.badge.id === 'marke-fynd')!;
    expect(fynd.value).toBe(1);
    // Inget av Hugos fynd kommer med i Emilias tidslinje.
    const tl = timeline(x, viewBadges('emilia', BADGES, x)!, (id) => id).filter((e) => e.type === 'fynd');
    expect(tl.map((e) => e.title)).toEqual(['x']);
  });

  it('en annan medlem: platser, avbockat, omdömen och palett är medlemmens egna', () => {
    const s = src({
      statusRows: [
        { user_id: 'hugo', place_id: 'FR', status: 'besokt', together_group: null },
        { user_id: 'hugo', place_id: 'IT', status: 'besokt', together_group: G },
        { user_id: 'emilia', place_id: 'ES', status: 'besokt', together_group: null },
      ],
      checksByUser: { hugo: [{ item_id: 'i1', done_on: '2026-01-01' }], emilia: [{ item_id: 'i2', done_on: '2026-01-02' }] },
      reviews: [
        { created_by: 'hugo', created_at: '2026-01-01T00:00:00Z' },
        { created_by: 'emilia', created_at: '2026-01-02T00:00:00Z' },
        { created_by: 'emilia', created_at: '2026-01-03T00:00:00Z' },
      ],
      customPaletteByUser: { hugo: true, emilia: false },
    });
    const x = viewInput('emilia', hugo, 'hugo', s);
    expect(x.statuses.map((r) => r.place_id).sort()).toEqual(['ES', 'IT']);
    expect(x.checks.map((c) => c.item_id)).toEqual(['i2']);
    expect(x.reviews).toHaveLength(2);
    expect(x.customPalette).toBe(false);
  });

  it('märken för samlingar och Valvet saknas i läget för en annan medlem', () => {
    const x = viewInput('emilia', hugo, 'hugo', src());
    const list = ids(viewBadges('emilia', BADGES, x));
    expect(list).not.toContain('marke-samlare');
    expect(list).not.toContain('marke-valvet');
    expect(list).toContain('marke-fynd');
    expect(ids(viewBadges('jag', BADGES, hugo))).toEqual(expect.arrayContaining(['marke-samlare', 'marke-valvet']));
  });

  it('inga märken i Tillsammans och Någon av oss', () => {
    expect(viewBadges('tillsammans', BADGES, hugo)).toBeNull();
    expect(viewBadges('nagon', BADGES, hugo)).toBeNull();
  });

  it('fynden i gruppens lägen: Någon av oss är minst en, Tillsammans är alla', () => {
    const f = { hugo: [find('a', '2026-01-01'), find('b')], emilia: [find('a', '2026-02-01'), find('c')] };
    expect(groupFinds('nagon', f, members).map((x) => x.compendium_id).sort()).toEqual(['a', 'b', 'c']);
    expect(groupFinds('nagon', f, members).find((x) => x.compendium_id === 'a')?.found_on).toBe('2026-01-01');
    expect(groupFinds('tillsammans', f, members).map((x) => x.compendium_id)).toEqual(['a']);
    expect(groupFinds('tillsammans', f, members)[0].found_on).toBe('2026-02-01');
    expect(viewInput('nagon', hugo, 'hugo', src({ findsByUser: f })).finds).toHaveLength(3);
  });

  it('toasten för nytt märke gäller bara läget Jag (och solo)', () => {
    const s = viewBadges('jag', BADGES, hugo);
    expect(toastBadges('jag', s)).toBe(s);
    expect(toastBadges(null, s)).toBe(s);
    expect(toastBadges('emilia', viewBadges('emilia', BADGES, hugo))).toBeNull();
    expect(toastBadges('tillsammans', null)).toBeNull();
    expect(toastBadges('nagon', null)).toBeNull();
  });
});
