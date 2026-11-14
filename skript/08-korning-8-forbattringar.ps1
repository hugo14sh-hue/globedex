# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '08 - Körning 8: förbättringar'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 7 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'Slutrapporten har Kartans licensvillkor och Lighthouse för /karta'
  'Karta: topplisten täcker inte knapparna, flaggor i listan, färgen tonas ned när du zoomar in'
  'Listor, Kompendium: tryck på ett kort och bocka av, och prova Markera flera'
  'build, typecheck, test och test:e2e är gröna'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md och docs/schema.sql innan du gör något. Körning 1 till 7 är klara. Den här körningen är förbättringar efter att Hugo har använt appen.

DEL A - efter Körning 7:

1. Båda SQL-blocken från din slutrapport i Körning 7 är körda i Supabase, oförändrade (execute bara för inloggade, created_by-reglerna på trips och bucket_items, profile_update). Uppdatera docs/schema.sql så att filen motsvarar databasen. Innehållet är importerat med delmålen.

DEL B - Körning 8:

1. Fel på Karta: topplisten ligger över knapparna Min karta och Vår karta. Listen ska ha en egen plats överst, och innehållet under den ska börja nedanför den, i alla bredder från 360 px och med safe-area. Lägg till ett röktest som kontrollerar att knapparna inte täcks.

2. Kompendium: bocka av direkt. I vyerna Kort och Kompendium öppnar ett tryck på ett kort ett bottenark med samling.hittad-knapp. Där kan man ange datum (samling.nar, eller samling.vet-inte-nar som sparar utan datum) och plats (samling.var, valfri, förvald till kortets plats). Ett hittat kort får i stället samling.ta-bort-fynd. Lägg till läget samling.markera-flera: man trycker på flera kort, raden längst ned visar samling.valda och knappen samling.lagg-till-valda sparar alla utan datum i ett enda anrop och visar samling.flera-klart. Ett fynd som läggs till så här ger inget konfettibesked per kort. Det ska inte gå att få dubbla fynd av samma kort i samma grupp. Kräver det en unik regel i databasen: ge mig ett SQL-block.

3. Kartans källor. Läs först licensvillkoren för OpenStreetMap, OpenMapTiles och OpenFreeMap och redovisa i slutrapporten vad de kräver. Gör sedan källraden så liten som villkoren tillåter: hopfälld bakom i-knappen från start på alla skärmbredder (MapLibres kompakta läge), utfälld bara när man trycker, och med aria-label från karta.kallor. Tillåter villkoren inte hopfällt läge: låt raden synas, men i liten stil som inte täcker kartan. Flytta inte källorna till en annan sida.

4. Kartan på nära håll. Landsfälten är grova och ser kantiga ut när man zoomar in på en stad. Tona ned fältens täckning mjukt mellan zoom 4 och 7, så att baskartan syns igenom och bara en svag ton och en tunn kant är kvar. Använd finare gränser (Natural Earth 1:10 m) som laddas först när man zoomar in, om filen kan hållas under 1,5 MB komprimerad. Annars räcker nedtoningen. Kartan får inte bli långsammare att starta: mät Lighthouse för /karta före och efter.

5. Flaggor i stället för landskoden. I listan med platser, i bottenarket, på landssidan och i resor visas landets flagga som SVG i stället för rutan med SE, DK och så vidare. Inga emojier. Använd en flagguppsättning med fri licens (redovisa licensen), ladda bara de flaggor som visas och lägg dem inte i huvudpaketet. Flaggan är dekor bredvid landets namn: tom alt-text. En stad eller region visar landets flagga med en liten nål i hörnet, så att Borås och Sverige inte ser likadana ut. Saknas en flagga visas landskoden som i dag. Statusfärgen visas som en ring runt flaggan.

6. Förbered för fler språk, utan att lägga till något språk ännu. All text går redan genom t(). Kontrollera att inget synligt på skärmen är hårdkodat (datum, tal, valuta och restid ska formateras med Intl efter appens språk, inte fast sv-SE), och lista i slutrapporten varje ställe där innehåll ur databasen visas, så att Hugo vet vad som behöver översättas. Bygg inget språkval.

Regler: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: ge mig SQL-block med GRANT-rader, och appen ska tåla att blocket inte är kört. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md.

Avsluta med npm run build, npm run typecheck, npm test och npm run test:e2e, gör en git commit med meddelandet "Körning 8: förbättringar", och skriv slutrapporten innan du avslutar turen. Vänta inte på bakgrundsjobb: kör mätningar i förgrunden med tidsgräns. Rubriker: Klart, Inte klart, Röktestet, Kartans licensvillkor, Lighthouse för /karta före och efter, Texter ur databasen som behöver översättas, Saknade textnycklar, Det här behöver Hugo göra.
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
