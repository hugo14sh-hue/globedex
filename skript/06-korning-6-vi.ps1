# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '06 - Körning 6: vi och valvet'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning med ny del av appen.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'Slutrapporten har rubriken Röktestet med resultat (kräver TEST_EMAIL och TEST_PASSWORD i .env.local)'
  'build, typecheck och test är gröna'
  'npm run dev: skapa en kod i Valvet, lägg in en post, lås och lås upp'
  'Märken och Siffror visar rätt antal länder'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, docs/schema.sql och delen Vi i docs/prototyp.html innan du gör något. Körning 1 till 5 är klara.

DEL A - efter Körning 5:

1. SQL-blocket från din slutrapport i Körning 5 är kört i Supabase, oförändrat (saved_ideas.done_at). Uppdatera docs/schema.sql så att filen motsvarar databasen.

2. Gränserna i Nära är godkända: 60, 180, 240 och 480 minuter, och en minut per kilometer fågelvägen när restid saknas. Ändra inget där.

3. Gör om till resa från Idag ska sätta landets status till planerad på samma villkor som planeraren (bara om status är tom eller vill åka).

4. Röktest i webbläsare. Tre körningar i rad är bara byggda och enhetstestade, inget är provat inloggat. Finns raderna TEST_EMAIL och TEST_PASSWORD i .env.local: installera Playwright som dev-beroende och skriv npm run test:e2e som startar appen lokalt, loggar in med testkontot i en 390 px bred mobilvy och går igenom: kartan laddas och status sätts på ett land, landssidan för Nederländerna öppnas och en listpunkt bockas av, fyndet syns i samlingsboken, en punkt läggs till ur bucketkatalogen, en resa skapas i planeraren och en utgift läggs in, Idag slumpar en idé hemma. Testet städar efter sig (tar bort det det skapade). Rätta de fel testet hittar och redovisa dem i slutrapporten. Uppgifterna får aldrig skrivas ut, loggas eller checkas in. Saknas raderna: hoppa över punkten och skriv det överst i slutrapporten.

DEL B - Körning 6:

Läs docs/korning-6.md och gör den. Tillägg:
- Texter för körningen finns i content/_texter.json: vi.siffror.*, marke.*, wrapped.*, tidslinje.typ.*, valv.*, guide.*, export.*, land.regler-for-dig.*, land.regler.alder. Wrapped-slutet har platshållaren {ar}.
- Märken: listan marken i _texter.json har 24 märken. Vardagsäventyraren räknar sparade idéer med done_at. Märken som kräver två personer (Samma tanke, Kvitt) döljs i solo.
- Valvet: typerna är pass, forsakring, nodkontakt, halsa, fodelsedatum och annat, med fälten i valv.falt.*. Allt innehåll, även typen av fält inom en post, ligger i chiffertexten. Kolumnen kind är det enda som står i klartext. Saltet behöver en plats: finns ingen kolumn för det, ge mig ett SQL-block.
- Guiden: synligheten offentlig finns i tabellen men erbjuds inte i appen. Bara privat och grupp.
- Regler för dig: räknas ut i webbläsaren från födelsedatum i Valvet och min_age på reglerna. Ålder, födelsedatum och hälsouppgifter får aldrig skickas till Supabase i klartext, läggas i localStorage eller skrivas i loggar.

Regler: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block med GRANT-rader och förklarar varför, och appen ska tåla att blocket inte är kört. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md.

Avsluta med npm run build, npm run typecheck och npm test (och npm run test:e2e om testkontot finns), gör en git commit med meddelandet "Körning 6: vi och valvet", och skriv en slutrapport med rubrikerna: Klart, Inte klart, Röktestet, Saknade textnycklar, Det här behöver Hugo göra.
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
