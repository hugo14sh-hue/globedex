// Kontroll av gränssnittets texter på två språk: content/_texter.json (svenska) och _texter.en.json.
// Varje nyckel ska finnas i båda filerna, med samma form (sträng eller språkstilar) och samma
// platshållare ({namn}). Märkena ska ha samma id, regel och nivåer. Används av enhetstestet och
// av npm run import:check.

const TONES = ['neutral', 'lekfull', 'romantisk'];

/** Platshållarna i en text, sorterade. */
export const placeholders = (s) => [...new Set([...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

const form = (e) => (typeof e === 'string' ? 'sträng' : e && typeof e === 'object' && !Array.isArray(e) ? 'stilar' : 'okänd');
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Platshållarna per stil. En sträng gäller i alla stilar. */
function byTone(e) {
  const out = {};
  for (const tone of TONES) {
    const s = typeof e === 'string' ? e : e?.[tone];
    if (s !== undefined) out[tone] = placeholders(s);
  }
  return out;
}

/**
 * Jämför två textfiler. Svarar med en lista fel som { file, key, message }. a och b är de inlästa
 * filerna, aName och bName deras namn i felen.
 */
export function compareTexts(a, b, aName = '_texter.json', bName = '_texter.en.json') {
  const errors = [];
  const ta = a?.texter ?? {};
  const tb = b?.texter ?? {};
  for (const [x, y, nx, ny] of [
    [ta, tb, aName, bName],
    [tb, ta, bName, aName],
  ])
    for (const key of Object.keys(x)) if (!(key in y)) errors.push({ file: ny, key, message: `saknas (finns i ${nx})` });

  for (const key of Object.keys(ta)) {
    if (!(key in tb)) continue;
    const ea = ta[key];
    const eb = tb[key];
    const fa = form(ea);
    const fb = form(eb);
    if (fa === 'okänd') errors.push({ file: aName, key, message: 'är varken sträng eller språkstilar' });
    if (fb === 'okänd') errors.push({ file: bName, key, message: 'är varken sträng eller språkstilar' });
    if (fa === 'okänd' || fb === 'okänd') continue;
    if (fa !== fb) {
      errors.push({ file: bName, key, message: `har formen ${fb}, ${aName} har ${fa}` });
      continue;
    }
    if (fa === 'stilar') {
      const ka = Object.keys(ea).sort();
      const kb = Object.keys(eb).sort();
      if (!same(ka, kb)) errors.push({ file: bName, key, message: `har stilarna ${kb.join(', ')}, ${aName} har ${ka.join(', ')}` });
    }
    // En sträng jämförs en gång, språkstilar en gång per stil.
    const pa = fa === 'sträng' ? { neutral: placeholders(ea) } : byTone(ea);
    const pb = fa === 'sträng' ? { neutral: placeholders(eb) } : byTone(eb);
    for (const tone of Object.keys(pa)) {
      if (!pb[tone]) continue;
      if (!same(pa[tone], pb[tone]))
        errors.push({
          file: bName,
          key,
          message: `${fa === 'stilar' ? `${tone}: ` : ''}platshållarna {${pb[tone].join('}, {')}} skiljer sig från {${pa[tone].join('}, {')}} i ${aName}`,
        });
    }
  }

  const ma = Array.isArray(a?.marken) ? a.marken : [];
  const mb = Array.isArray(b?.marken) ? b.marken : [];
  for (const [x, y, ny] of [
    [ma, mb, bName],
    [mb, ma, aName],
  ])
    for (const m of x) if (!y.some((z) => z.id === m.id)) errors.push({ file: ny, key: `marken.${m.id}`, message: 'märket saknas' });
  for (const m of ma) {
    const o = mb.find((z) => z.id === m.id);
    if (!o) continue;
    if (o.rule !== m.rule) errors.push({ file: bName, key: `marken.${m.id}`, message: 'regeln skiljer sig' });
    if (JSON.stringify(o.levels ?? null) !== JSON.stringify(m.levels ?? null))
      errors.push({ file: bName, key: `marken.${m.id}`, message: 'nivåerna skiljer sig' });
    for (const f of ['name', 'text'])
      if (typeof o[f] !== 'string' || !o[f].trim()) errors.push({ file: bName, key: `marken.${m.id}`, message: `${f} saknas` });
  }
  return errors;
}

export const formatTextError = (e) => `${e.file} · ${e.key}: ${e.message}`;
