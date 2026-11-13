# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '05 - Körning 5: idag'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning med ny del av appen.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'build, typecheck och test är gröna'
  'npm run dev: Idag med platsen Hemma, slumpa några idéer och spara en'
  'Vyn Nära från Borås visar idéer med avstånd'
  'Resor: Hämta förslag i packlistan och i Innan avresa'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, docs/FORMAT.md, docs/schema.sql och delen Idag i docs/prototyp.html innan du gör något. Körning 1 till 4 är klara.

DEL A - efter Körning 4:

1. SQL-blocket från din slutrapport i Körning 4 är kört i Supabase, oförändrat (bokningstyper, bookings.url, bucketen bokningar med regler). Texterna styr, som du valde. Uppdatera docs/schema.sql så att filen motsvarar databasen.

2. Valutakurser: Frankfurter med ECB som källa är godkänd. Visa källan med texten kassa.kalla (med {kalla}).

3. Texterna du listade som saknade finns nu i content/_texter.json, plus nya för den här körningen: innan.forslag, innan.dagar-fore, innan.samma-dag, innan.dagen-fore, idag.typ.*, idag.tagg.*, idag.filter.*, idag.vy.*, idag.gjord, idag.markera-gjord, idag.ta-bort-sparad, idag.sparade.tom, idag.avstand, idag.restid, idag.plats.sparad, idag.plats.ny, idag.plats.valj.

4. content/_packlista.json finns nu (38 rader) i formatet du beskrev. Kontrollera att Hämta förslag fungerar med den och att importkontrollen (npm run import:check) validerar filen.

5. Innan avresa: content/_innan-avresa.json finns nu, med formatet { "items": [{ "id", "title", "hint", "days_before" }] }. hint är valfri. days_before är hur många dagar före avresan punkten senast bör vara gjord (0 = avresedagen). Filen läses in i appen vid bygget, som _packlista.json. Bygg knappen innan.forslag som lägger till punkterna som saknas (samma titel läggs inte till igen), sortera listan på days_before och visa innan.dagar-fore, innan.dagen-fore eller innan.samma-dag. Beskriv formatet i docs/FORMAT.md och validera filen i import:check.

DEL B - Körning 5:

Läs docs/korning-5.md och gör den. Tillägg:
- Innehållet har 99 idéer. 29 saknar place_id (hemma och ut en sväng) och fungerar var som helst. Ingen idé har drive_minutes än, så vyn Nära räknar avstånd fågelvägen från vald plats till idéns eller platsens koordinater och visar idag.avstand. idag.restid används bara när drive_minutes finns.
- Idéer med kind hemma visas när platsen är Hemma och för läget Idag. Idéer utan place_id med kind ut-en-svang visas på alla platser.
- Typ, taggar och kostnad har etiketter i _texter.json (idag.typ.*, idag.tagg.*, kostnad.*).
- En sparad idé som markeras som gjord räknas senare i märket Vardagsäventyraren (Körning 6). Spara tidpunkten.
- Gör om till resa: skapar en resa med en etapp från vald plats till idéns plats och öppnar den i Resor. Idéer utan plats har inte knappen.

Regler: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block med GRANT-rader och förklarar varför, och appen ska tåla att blocket inte är kört. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md.

Avsluta med npm run build, npm run typecheck och npm test, gör en git commit med meddelandet "Körning 5: idag", och skriv en slutrapport med rubrikerna: Klart, Inte klart, Saknade textnycklar, Det här behöver Hugo göra.
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
