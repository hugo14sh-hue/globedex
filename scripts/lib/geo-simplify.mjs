// Förenkling av ytor för kartläget Regioner, delad av make-regions.mjs (delstater) och make-landskap.mjs.
// Douglas-Peucker per ring, sedan avrundning till två decimaler. Ringar som blir för små faller bort.

export const r2 = (n) => Math.round(n * 100) / 100;

/** Avstånd i kvadrat från p till sträckan a–b. */
function segDist2(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker utan rekursion. Första och sista punkten behålls. */
function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [first, last] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(points[i], points[first], points[last]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx > 0 && max > t2) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ring(r, tol) {
  const out = [];
  for (const p of simplify(r, tol)) {
    const q = [r2(p[0]), r2(p[1])];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  // En ring behöver minst fyra punkter (den sista är samma som den första).
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) out.push(out[0]);
  return out.length >= 4 ? out : null;
}

/** Förenklad Polygon eller MultiPolygon. Tom coordinates-lista om allt föll bort. */
export function cleanGeometry(geom, tol) {
  const poly = (rings) => {
    const list = rings.map((r) => ring(r, tol));
    // Faller ytterringen bort (en liten ö) faller hela ytan bort.
    return list[0] ? list.filter(Boolean) : [];
  };
  const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).map(poly).filter((p) => p.length);
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}
