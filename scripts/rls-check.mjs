// Kontroll av databasens regler (RLS): vad kan en inloggad användare utanför gruppen läsa och skriva?
// Körs lokalt av Hugo: npm run rls:check. Kräver TEST_EMAIL och TEST_PASSWORD (testkontot) och
// SUPABASE_SECRET_KEY i .env.local. Den hemliga nyckeln används bara för att hitta rader som tillhör
// någon annan att prova mot. Alla försök görs som testkontot med den publicerbara nyckeln.
// Inget innehåll, inga uppgifter och inga nycklar skrivs ut, bara tillåtet eller stoppat.
//
// Uppdateringar skriver samma värde som redan finns, så inget ändras även om regeln släpper igenom.
// Lyckas ett insert som borde stoppas tas raden bort direkt med den hemliga nyckeln.
// Delete provas inte mot andras rader (det går inte att göra ofarligt): där gäller samma villkor som
// för uppdatering i alla regler utom groups och group_members, som har egna delete-regler.
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readEnv() {
  const text = (await readFile(join(root, '.env.local'), 'utf8')).replace(/^﻿/, '');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const env = await readEnv();
for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'TEST_EMAIL', 'TEST_PASSWORD']) {
  if (!env[k]) {
    console.error(`${k} saknas i .env.local.`);
    process.exit(1);
  }
}
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SECRET_KEY, opts);
const user = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, opts);
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, opts);

const { data: login, error: loginErr } = await user.auth.signInWithPassword({ email: env.TEST_EMAIL, password: env.TEST_PASSWORD });
if (loginErr) {
  console.error(`Inloggningen med testkontot misslyckades (${loginErr.code})`);
  process.exit(1);
}
const me = login.user.id;

async function all(q) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------- Vad är "mitt" och vad är någon annans ----------
const myGroups = (await all(admin.from('group_members').select('group_id').eq('user_id', me))).map((r) => r.group_id);
const myMates = new Set((await all(admin.from('group_members').select('user_id').in('group_id', myGroups))).map((r) => r.user_id));
const myTrips = new Set((await all(admin.from('trips').select('id').in('group_id', myGroups))).map((r) => r.id));
const myCollections = new Set((await all(admin.from('collections').select('id').eq('user_id', me))).map((r) => r.id));
const isMineGroup = (g) => myGroups.includes(g);

const first = async (table, filter) => (await all(filter(admin.from(table).select('*')).limit(1)))[0] ?? null;
const notMine = (q, col, list) => (list.length ? q.not(col, 'in', `(${list.map((x) => `"${x}"`).join(',')})`) : q);

const fGroup = (await first('groups', (q) => notMine(q, 'id', myGroups)))?.id ?? null;
const fUser = (await first('profiles', (q) => notMine(q, 'id', [...myMates])))?.id ?? null;
const fTrip = (await first('trips', (q) => notMine(q, 'id', [...myTrips])))?.id ?? null;
const fCollection = (await first('collections', (q) => notMine(q, 'id', [...myCollections])))?.id ?? null;
const anyItem = (await first('place_items', (q) => q))?.id ?? null;
const anyComp = (await first('compendium_items', (q) => q))?.id ?? null;

// Per tabell: hur man känner igen någon annans rad, nyckeln för uppdatering, en ofarlig kolumn och ett insert.
const owner = {
  user: (r) => r.user_id !== me && !myMates.has(r.user_id),
  group: (r) => !isMineGroup(r.group_id),
  trip: (r) => !myTrips.has(r.trip_id),
};
const T = [
  { t: 'profiles', other: (r) => r.id !== me && !myMates.has(r.id), key: 'id', col: 'display_name', ins: fUser && { id: fUser } },
  {
    t: 'groups',
    other: (r) => !isMineGroup(r.id),
    key: 'id',
    col: 'name',
    ins: fUser && { name: 'rls-test', kind: 'solo', created_by: fUser },
  },
  { t: 'group_members', other: owner.group, key: ['group_id', 'user_id'], col: 'role', ins: fGroup && { group_id: fGroup, user_id: me } },
  { t: 'group_invites', other: owner.group, key: 'code', col: 'expires_at', ins: fGroup && { group_id: fGroup, created_by: me } },
  {
    t: 'place_status',
    other: owner.user,
    key: ['user_id', 'place_id'],
    col: 'status',
    ins: fUser && { user_id: fUser, place_id: 'AQ', status: 'vill' },
  },
  {
    t: 'item_checks',
    other: owner.user,
    key: ['user_id', 'item_id'],
    col: 'note',
    ins: fUser && anyItem && { user_id: fUser, item_id: anyItem },
  },
  {
    t: 'finds',
    other: owner.user,
    key: ['user_id', 'compendium_id'],
    col: 'note',
    ins: fUser && anyComp && { user_id: fUser, compendium_id: anyComp },
  },
  {
    t: 'swipe_votes',
    other: owner.user,
    key: ['user_id', 'catalog_id'],
    col: 'wants',
    ins: fUser && { user_id: fUser, catalog_id: 'rls-test' },
  },
  { t: 'bucket_items', other: owner.group, key: 'id', col: 'title', ins: fGroup && { group_id: fGroup, title: 'rls-test' } },
  { t: 'collections', other: owner.user, key: 'id', col: 'name', ins: fUser && { user_id: fUser, name: 'rls-test' } },
  {
    t: 'collection_entries',
    other: (r) => !myCollections.has(r.collection_id),
    key: ['collection_id', 'place_id'],
    col: 'note',
    ins: fCollection && { collection_id: fCollection, place_id: 'AQ' },
  },
  { t: 'recipients', other: owner.user, key: 'id', col: 'name', ins: fUser && { user_id: fUser, name: 'rls-test' } },
  { t: 'saved_locations', other: owner.user, key: 'id', col: 'name', ins: fUser && { user_id: fUser, name: 'rls-test' } },
  { t: 'reviews', other: owner.group, key: 'id', col: 'name', ins: fGroup && { group_id: fGroup, name: 'rls-test', created_by: me } },
  { t: 'saved_ideas', other: owner.group, key: 'id', col: 'title', ins: fGroup && { group_id: fGroup, title: 'rls-test' } },
  {
    t: 'vault_items',
    other: (r) => r.user_id !== me,
    key: 'id',
    col: 'kind',
    ins: fUser && { user_id: fUser, kind: 'annat', ciphertext: 'x', iv: 'x' },
  },
  { t: 'trips', other: owner.group, key: 'id', col: 'title', ins: fGroup && { group_id: fGroup, title: 'rls-test' } },
  {
    t: 'trip_legs',
    other: owner.trip,
    key: 'id',
    col: 'note',
    ins: fTrip && { trip_id: fTrip, mode: 'bil', from_text: 'a', to_text: 'b' },
  },
  { t: 'bookings', other: owner.trip, key: 'id', col: 'title', ins: fTrip && { trip_id: fTrip, kind: 'annat', title: 'rls-test' } },
  { t: 'expenses', other: owner.trip, key: 'id', col: 'title', ins: fTrip && { trip_id: fTrip, title: 'rls-test', amount: 1 } },
  { t: 'packing_items', other: owner.trip, key: 'id', col: 'title', ins: fTrip && { trip_id: fTrip, title: 'rls-test' } },
  { t: 'pretrip_items', other: owner.trip, key: 'id', col: 'title', ins: fTrip && { trip_id: fTrip, title: 'rls-test' } },
  { t: 'shopping_items', other: owner.trip, key: 'id', col: 'title', ins: fTrip && { trip_id: fTrip, user_id: me, title: 'rls-test' } },
];
const CONTENT = ['places', 'place_facts', 'place_items', 'compendium_items', 'bucket_catalog', 'ideas', 'gift_tips'];

const keyFilter = (q, key, row) => (Array.isArray(key) ? key : [key]).reduce((qq, k) => qq.eq(k, row[k]), q);

const results = [];
for (const x of T) {
  const r = { tabell: x.t };
  // Läsa: alla rader som testkontot ser, och hur många av dem som tillhör någon annan.
  const { data: seen, error: readErr } = await user.from(x.t).select('*').limit(1000);
  r.lasa = readErr ? `fel (${readErr.code})` : `${seen.filter(x.other).length} andras`;
  const { data: anonSeen, error: anonErr } = await anon.from(x.t).select('*').limit(5);
  r.anon = anonErr ? 'stoppad' : `${anonSeen.length} rader`;

  // Skriva: ett insert som pekar på någon annan.
  if (!x.ins) r.lagga = 'ingen främmande rad att prova mot';
  else {
    const { data, error } = await user.from(x.t).insert(x.ins).select('*');
    if (error) r.lagga = 'stoppad';
    else {
      r.lagga = 'TILLÅTEN';
      for (const row of data ?? []) await keyFilter(admin.from(x.t).delete(), x.key, row);
    }
  }

  // Uppdatera någon annans rad med samma värde (ändrar inget).
  const target = (await all(admin.from(x.t).select('*').limit(1000))).find(x.other) ?? null;
  if (!target) r.andra = 'ingen främmande rad att prova mot';
  else {
    const { data, error } = await keyFilter(user.from(x.t).update({ [x.col]: target[x.col] }), x.key, target).select('*');
    r.andra = error ? 'stoppad' : data.length ? 'TILLÅTEN' : 'stoppad (0 rader)';
  }
  results.push(r);
}

for (const t of CONTENT) {
  const { data, error } = await user.from(t).select('id').limit(1);
  const ins = await user.from(t).insert({ id: 'rls-test' }).select('id');
  if (!ins.error) await admin.from(t).delete().eq('id', 'rls-test');
  const upd = await user
    .from(t)
    .update({ id: data?.[0]?.id ?? 'x' })
    .eq('id', data?.[0]?.id ?? 'x')
    .select('id');
  results.push({
    tabell: t,
    lasa: error ? `fel (${error.code})` : 'alla (innehåll)',
    anon: 'alla (innehåll)',
    lagga: ins.error ? 'stoppad' : 'TILLÅTEN',
    andra: upd.error ? 'stoppad' : upd.data?.length ? 'TILLÅTEN' : 'stoppad (0 rader)',
  });
}

// Funktioner och filer.
const extra = [];
if (fGroup) {
  const { data } = await user.rpc('is_member', { gid: fGroup });
  extra.push(`is_member(annan grupp): ${data}`);
}
if (fTrip) {
  const { data } = await user.rpc('can_trip', { tid: fTrip });
  extra.push(`can_trip(annan resa): ${data}`);
  const list = await user.storage.from('bokningar').list(fTrip);
  extra.push(`bokningsfiler i annan resas mapp: ${list.error ? 'stoppad' : `${list.data.length} synliga`}`);
  const up = await user.storage.from('bokningar').upload(`${fTrip}/rls-test.txt`, new Blob(['x'], { type: 'text/plain' }));
  if (!up.error) await admin.storage.from('bokningar').remove([`${fTrip}/rls-test.txt`]);
  extra.push(`ladda upp i annan resas mapp: ${up.error ? 'stoppad' : 'TILLÅTEN'}`);
}
const joined = await user.rpc('join_group', { invite_code: '000000000000' });
extra.push(`join_group med påhittad kod: ${joined.error ? 'stoppad' : 'TILLÅTEN'}`);
const anonCreate = await anon.rpc('create_group', { group_name: 'rls-test', group_kind: 'solo' });
extra.push(`create_group utan inloggning: ${anonCreate.error ? 'stoppad' : 'TILLÅTEN'}`);

console.log(
  `Främmande rader att prova mot: grupp ${fGroup ? 'ja' : 'nej'}, användare ${fUser ? 'ja' : 'nej'}, resa ${fTrip ? 'ja' : 'nej'}, samling ${fCollection ? 'ja' : 'nej'}`,
);
console.log('| Tabell | Läsa (andras rader) | Utan inloggning | Lägga till åt annan | Ändra annans rad |');
console.log('|---|---|---|---|---|');
for (const r of results) console.log(`| ${r.tabell} | ${r.lasa} | ${r.anon} | ${r.lagga} | ${r.andra} |`);
for (const e of extra) console.log(`- ${e}`);
const bad =
  results.filter((r) => [r.lagga, r.andra].includes('TILLÅTEN') || /^[1-9]/.test(r.lasa)).length +
  extra.filter((e) => /TILLÅTEN|true/.test(e)).length;
console.log(bad ? `\n${bad} punkter släpper igenom något.` : '\nInget släpptes igenom.');
await user.auth.signOut();
process.exitCode = 0;
