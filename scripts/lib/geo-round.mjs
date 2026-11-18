// Avrundning av ytor till två decimaler utan förenkling, som public/geo/lander.json (scripts/make-countries.mjs).
// Används av scripts/make-delade.mjs så att delarna får samma detaljnivå som länderna.

const round = (c) => (typeof c[0] === 'number' ? [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100] : c.map(round));

/** Tar bort punkter som blev dubbletter efter avrundningen. */
function dedupe(ring) {
  const out = [];
  for (const p of ring) {
    const q = out[out.length - 1];
    if (!q || q[0] !== p[0] || q[1] !== p[1]) out.push(p);
  }
  return out;
}

/** Polygon eller MultiPolygon, avrundad. Ringar med färre än fyra punkter faller bort. */
export function roundGeometry(geom) {
  const poly = (rings) => rings.map((r) => dedupe(round(r))).filter((r) => r.length >= 4);
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: poly(geom.coordinates) };
  return { type: 'MultiPolygon', coordinates: geom.coordinates.map(poly).filter((p) => p.length) };
}
