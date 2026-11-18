// Delar av delade länder (content/_landlistor.json, fältet delade) som saknar egen flagga i appen och visas med
// sitt lands flagga. Nordirland har ingen egen officiell flagga och visas med Storbritanniens (Körning 19).
// Läses av scripts/make-flags.mjs (som kopierar övriga delars flaggor från flag-icons) och src/lib/delade.ts.
export const NO_OWN_FLAG: readonly string[] = ['GB-nir'];
