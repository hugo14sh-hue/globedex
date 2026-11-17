# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '15 - Körning 15: fliken Upptäck'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 14 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'EFTER: npm run import, så att platserna och texterna hamnar i databasen'
  'Upptäck: välj Mycket billigt, Sarajevo och Tirana ska finnas i listan'
  'Öppna Monaco: rutan Liknande men billigare med Menton, Nice, Sanremo och Kotor'
  'Vi: tryck på Kontinenter, namnen ska stå i stället för 142, 150 och 003'
  'Anpassning: valet med 197 länder finns'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 14 är klara.

Körning 15: fliken Upptäck

Nytt innehåll finns i content/: filen _upptack.json (ny), _landlistor.json (en ny lista) och textfilerna (69 nya nycklar, 691 per språk). Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten.

1. content/_upptack.json. Läs filens _om först. Den innehåller:
   - places: 69 lätta platser i Europa. Fält: id, name, country (landskod), lat, lon, level (1-5), level_rule, level_note (bara när level avviker från regeln), climate, best_months (månadsnummer), tags, gem (smultronställe), why (en mening), citybreak_gbp (bara vissa).
   - existing: klimat och taggar för städer som redan har fullt innehåll i landsfilerna. Deras prisnivå kommer från prices.level och deras bästa månader är de månader där smart_months är 4 eller 5.
   - alternatives: rader med for (den dyrare platsen), place (alternativet), why och cheaper (sant när alternativet har lägre prisnivå).
   - tags och climates: de tillåtna värdena. pli_restaurants_hotels: Eurostats index per land, pli_year: året.
   Lägg valideringen i import:check: id-formatet, att country finns bland appens länder, att level är 1 till 5, att tags och climate finns i listorna, att månaderna är 1 till 12, att varje for och place i alternatives finns bland places eller bland befintliga platser, och att ett alternativ aldrig har högre prisnivå än platsen det hör till.

2. Lagring. De lätta platserna ska gå att spara som Vill åka och öppna som platser. Importera dem till places som städer under sitt land, med fälten ovan i data och data.light = true. Befintliga platser får climate och tags i data från existing. Alternativen lagras i data.alternatives på den dyrare platsen. Går det inte utan databasändring: bygg inte runt det, ge mig ett SQL-block och skriv varför.
   En lätt plats har ingen kompendium, inga saker och inga priser. Dess sida visar namn, land, why, prisnivån, bästa månader, taggarna, rutan med alternativ och statusvalet, och inga tomma rubriker. Lätta platser ska inte räknas i statistik över städer med innehåll och inte visas som stadsprickar på kartan förrän de har en status.

3. Ny flik med namnet flik.upptack, placerad direkt efter Karta. Får flikraden inte plats på 390 px bredd: lös det på samma sätt som appen redan hanterar många flikar, och skriv i slutrapporten hur. Överst står ingress.upptack på samma sätt som i övriga flikar.

4. Filter (rubrik upptack.filter.rubrik). Alla filter kan kombineras, och inget är valt från början:
   - upptack.filter.pris: fem val, upptack.pris.1 till upptack.pris.5, flera kan väljas.
   - upptack.filter.manad: tolv månader plus upptack.filter.manad.alla. En plats matchar när månaden finns bland dess bästa månader.
   - upptack.filter.klimat: upptack.klimat.<värde>.
   - upptack.filter.typ: taggarna, upptack.tagg.<värde>. Väljs flera måste platsen ha alla.
   - upptack.filter.kontinent och upptack.filter.land: bara värden som har minst en plats.
   - upptack.filter.smultron och upptack.filter.obesokt (döljer platser med status besökt, bor eller har bott).
   - upptack.filter.rensa nollställer.
   Valda filter sparas i adressen (query-parametrar), så att en filtrering går att dela och ligger kvar när man backar.

5. Listan. Antal: upptack.antal eller upptack.antal.en. Sortering (upptack.sortera): upptack.sortera.pris är förvald (lägst prisnivå först, sedan namn), upptack.sortera.namn. Tom lista: upptack.tom.
   Varje kort: namn och land med flagga, prisnivån som fem markeringar med aria-label upptack.kort.pris.aria och texten upptack.pris.<nivå>, why, upptack.kort.basta med månadernas korta namn, taggarna, märket upptack.kort.smultron när gem är sant, och knappen upptack.kort.vill som sätter status Vill åka (efteråt står upptack.kort.sparad). Hela kortet öppnar platsen, med aria-label upptack.kort.oppna. Befintliga städer visas i samma lista med sin text från landsfilen där why saknas: använd den korta text som redan visas för staden, och hittar du ingen, visa kortet utan text och skriv det i slutrapporten.
   Under listan står upptack.kalla.

6. Alternativ. På sidan för en plats som har alternatives visas en ruta med rubriken upptack.alt.rubrik när minst ett alternativ har cheaper sant, annars upptack.alt.rubrik.lika. Varje rad: alternativets namn, land, prisnivå och why från alternativraden, och den öppnar alternativet. I Upptäck får kort för platser med nivå 4 eller 5 som har alternativ en länk med texten upptack.alt.till som fäller ut samma rader.

7. Källrader på en lätt plats sida: upptack.index ({plats} är landets namn, {antal} landets värde i pli_restaurants_hotels, {ar} är pli_year), level_note när den finns, och upptack.barometer när citybreak_gbp finns ({belopp} är värdet, {ar} är 2026).

8. Landlistan. _landlistor.json har en ny lista, fn_plus_tw_xk, med koderna TW och XK. Nytt val mellan landlista.fn-plus och landlista.alla: landlista.fn-tw-xk, som är FN:s medlemmar, observatörerna och de två koderna (197). Saknas TW eller XK bland appens länder: lägg inte till dem själv, skriv det i slutrapporten.

9. Färgen för vill åka i paletten Terrakotta ligger för nära besökt (5,4). Byt vill åka i den paletten till en färg som ger minst 10 mot besökt, planerad och de fyra sällskapsfärgerna, i samma kulörfamilj som paletten, och ta bort paret ur testets undantagslista. Skriv värdet i slutrapporten.

11. Fel i Vi: trycker man på rutan Kontinenter visas koderna 142, 150 och 003 i stället för namn. Visa namnet från nyckeln kontinent.<kod> (002, 142, 150, 003, 005, 009, 010) överallt där en världsdel visas, också i filtret upptack.filter.kontinent. Använder appen andra koder än de sju: skriv vilka i slutrapporten. Gå igenom de övriga rutorna i Vi (länder, landskap, delstater, fynd) och kontrollera att ingen av dem visar koder eller id i stället för namn.

10. Enhetstester: varje filter för sig, två filter ihop, sorteringen, bästa månader för befintliga städer ur smart_months, regeln för rubriken i alternativrutan, valideringen i import:check, den nya landlistan (197). Röktestet: öppna Upptäck, välj upptack.pris.1 och kontrollera att Sarajevo finns i listan och att Monaco inte gör det, spara Sarajevo som Vill åka och städa efteråt, öppna Monaco och kontrollera att Menton står i alternativrutan.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 15: Upptäck" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
'@
# =========================================================

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$proj = Split-Path -Parent $here
if (-not (Test-Path (Join-Path $proj 'CLAUDE.md'))) { Write-Host "Hittar inte projektet (CLAUDE.md saknas i $proj)." -ForegroundColor Red; return }

Write-Host ""
Write-Host "=== $steg ===" -ForegroundColor Cyan

# .env.local: kontrollera att raderna finns och är ifyllda (värdena visas aldrig)
$envFil = Join-Path $proj '.env.local'
$fel = 0
if (-not (Test-Path $envFil)) { Write-Host "  .env.local saknas." -ForegroundColor Red; $fel++ }
else {
  $rader = Get-Content $envFil -Encoding UTF8
  foreach ($k in $kravEnv) {
    $rad = $rader | Where-Object { $_ -match "^\s*$k\s*=" } | Select-Object -First 1
    $v = if ($rad) { ($rad -split '=', 2)[1].Trim().Trim('"').Trim("'") } else { '' }
    if (-not $v -or $v -match '\.\.\.$' -or $v -match 'xxxx') { Write-Host "  .env.local: $k saknas eller är inte ifylld." -ForegroundColor Red; $fel++ }
    else { Write-Host "  .env.local: $k finns." -ForegroundColor DarkGray }
  }
}
if ($fel -gt 0) { Write-Host "Fyll i .env.local (docs\supabase-lathund.md) och kör skriptet igen." -ForegroundColor Red; return }

# Testkonto för röktestet (frivilligt men starkt rekommenderat)
$harTest = ($rader | Where-Object { $_ -match '^\s*TEST_EMAIL\s*=\s*\S' }) -and ($rader | Where-Object { $_ -match '^\s*TEST_PASSWORD\s*=\s*\S' })
if ($harTest) { Write-Host "  .env.local: testkonto finns, röktestet körs." -ForegroundColor DarkGray }
else { Write-Host "  .env.local: TEST_EMAIL och TEST_PASSWORD saknas. Röktestet hoppas över." -ForegroundColor Yellow }

# Git: visa om något är ocommittat
if (Get-Command git -ErrorAction SilentlyContinue) {
  $andrat = (git -C $proj status --porcelain 2>$null | Measure-Object).Count
  if ($andrat -gt 0) { Write-Host "  Git: $andrat ändrade filer som inte är committade (Claude Code committar i slutet av körningen)." -ForegroundColor DarkGray }
}

# Spara prompten bredvid skriptet och lägg den på urklipp
$promptFil = [IO.Path]::ChangeExtension($MyInvocation.MyCommand.Path, '.prompt.txt')
[IO.File]::WriteAllText($promptFil, $prompt, (New-Object System.Text.UTF8Encoding $false))
$prompt | Set-Clipboard

Write-Host ""
if ($session -eq 'NY') {
  Write-Host "  >>> NY SESSION <<<" -ForegroundColor Black -BackgroundColor Yellow
  Write-Host "  Claude Code: plusikonen (ny session, Local) i mappen globedex." -ForegroundColor Yellow
} else {
  Write-Host "  >>> SAMMA SESSION <<<" -ForegroundColor Black -BackgroundColor Green
  Write-Host "  Fortsätt i sessionen som körde förra steget." -ForegroundColor Green
}
Write-Host "  Varför: $varfor" -ForegroundColor Gray
Write-Host ""
Write-Host "  1. Ctrl+V, Enter. Bifoga inga filer." -ForegroundColor White
Write-Host "  2. Svara Ja på kommandotillstånd. Rör inget under körningen." -ForegroundColor White
Write-Host "  3. När den är klar - kontrollera:" -ForegroundColor White
foreach ($r in $kontroll) { Write-Host "     - $r" -ForegroundColor White }
Write-Host "  4. Klistra in slutrapporten i Claude-chatten." -ForegroundColor White
Write-Host ""
Write-Host "Prompten ligger på urklipp (och i $(Split-Path -Leaf $promptFil))." -ForegroundColor Green
if (Get-Command code -ErrorAction SilentlyContinue) { code $proj }
