# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '04 - Körning 4: resor'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning med ny del av appen.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'build, typecheck och test är gröna'
  'npm run dev: planera en resa till Amsterdam genom alla steg'
  'Lägg in två utgifter i olika valutor och kontrollera skulderna'
  'Slutrapporten har ett SQL-block för bokningsfiler och ett förslag på kurskälla'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, docs/schema.sql och delen Resor i docs/prototyp.html innan du gör något. Körning 1 till 3 är klara.

DEL A - efter Körning 3:

1. SQL-blocket från din slutrapport i Körning 3 är kört i Supabase (swipe_votes.catalog_id med formatkontroll, bucket_items.place_id), plus en rad till: swipe_votes.wants är inte längre not null. Uppdatera docs/schema.sql så att filen motsvarar databasen.

2. Texterna du listade som saknade finns nu i content/_texter.json (falt.*, samling.okant, samling.kategori.*). Där finns också nya nycklar för den här körningen: kassa.falt.*, kassa.betala, resor.etapp.*, resor.budget.forslag, resor.avslutad, resor.pagar, resor.kommande, pack.forslag, pack.privat, bokningar.typ.*, bokningar.referens, bokningar.lank, falt.titel, falt.fran-datum, falt.till-datum. Använd dem i första hand och lista bara det som fortfarande saknas.

3. Swipe: Kanske sparas som röst med wants = null, så att kortet inte kommer tillbaka direkt nästa gång. Kanske räknas inte som ja i en match och syns inte i listan över gemensamma ja. Kort med kanske visas igen först när alla andra kort är slut. Skriv tester.

DEL B - Körning 4:

Läs docs/korning-4.md och gör den. Tillägg:
- Resans plats kan vara ett land utan innehåll. Då finns inga förslag på längd, månad eller budget: visa stegen ändå, utan förslag.
- Bokningsfiler: bygg bokningar så att de fungerar utan fil. Ge mig ett färdigt SQL-block som skapar en privat bucket i Supabase Storage med regler som följer can_trip, och slå på filuppladdningen bakom en kontroll som märker om bucketen finns.
- Valutakurser: föreslå en gratis källa utan nyckel, kontrollera villkoren och redovisa dem i slutrapporten innan den används i produktion. Kursen sparas på utgiften (rate_to_sek) och ändras aldrig i efterhand.
- Packlistans förslag: bara allmänna saker som hör till resans längd och månad får föreslås av appen om de finns som texter i content/. Finns inga sådana texter: bygg knappen men lista i slutrapporten vilken innehållsfil som behövs och i vilket format, så skriver Hugo den.
- Varje ny tabell, kolumn eller funktion: SQL-block till mig med GRANT-rader, och appen ska tåla att blocket inte är kört än (tydligt felbesked, ingen krasch).

Regler: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md.

Avsluta med npm run build, npm run typecheck och npm test, gör en git commit med meddelandet "Körning 4: resor", och skriv en slutrapport med rubrikerna: Klart, Inte klart, Saknade textnycklar, Det här behöver Hugo göra.
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
