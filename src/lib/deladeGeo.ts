// Mittpunkt och utsnitt för delarna i delade länder (content/_landlistor.json, fältet delade). Byggd av
// scripts/make-delade.mjs ur Natural Earth admin 0 map units (public domain), samma källa som public/geo/delade.json.
// Ingen innehållstext. Utsnittet är [väst, syd, öst, nord].
export const SPLIT_GEO: Record<string, { lat: number; lon: number; box: [number, number, number, number] }> = {
  'GB-eng': { lat: 52.61, lon: -1.4, box: [-5.66, 50.02, 1.75, 55.81] },
  'GB-sct': { lat: 56.79, lon: -4.05, box: [-7.54, 54.69, -0.77, 60.83] },
  'GB-wls': { lat: 52.14, lon: -3.64, box: [-5.26, 51.39, -2.66, 53.42] },
  'GB-nir': { lat: 54.66, lon: -6.47, box: [-8.14, 54.05, -5.47, 55.24] },
};
