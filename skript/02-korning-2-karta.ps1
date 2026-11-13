# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '02 - Körning 2: karta och innehåll'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Sessionen från Körning 1 har lång historik och fel antagande om schemat.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'Slutrapporten visar importen: 54 platser, 103 fakta, 186 listpunkter, 120 kompendium, 73 idéer, 45 presenttips, 93 bucket'
  'build, typecheck och test är gröna'
  'npm run dev: kartan visas, tryck på Sverige och sätt status, öppna Nederländerna och bläddra bland vyerna'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, docs/FORMAT.md, docs/schema.sql och kartdelen av docs/prototyp.html innan du gör något. Körning 1 är klar, schemat är kört i Supabase och inloggning med e-post och lösenord fungerar.

DEL A - före Körning 2:

1. Lägg till exakt de här nycklarna under "texter" i content/_texter.json (rena strängar, samma i alla stilar), om de inte redan finns:
"anpassa.textstorlek.liten": "Liten"
"anpassa.textstorlek.normal": "Normal"
"anpassa.textstorlek.stor": "Stor"
"anpassa.egen.primar": "Huvudfärg"
"anpassa.egen.accent": "Accentfärg"
"anpassa.egen.bakgrund": "Bakgrund"
"grupp.lamna": "Lämna gruppen"

2. Kontrast: kontrollera mörkt läge också. Text på primärfärgen väljs efter kontrast i båda lägena (mörk text där vit ger under 4,5:1), i alla fem paletter och i egen palett. Varningen för egen palett räknar båda lägena. Loggans färger rörs inte. Skriv tester.

3. HOME_PLACES: ta bort den hårdkodade listan. Startstegets förslag hämtas ur tabellen places (städer i Sverige) när innehållet är importerat. Finns inget innehåll visas bara fritextfältet.

4. Grupper: appen visar bara inbjudan för par och grupp, aldrig för en sologrupp, och erbjuder bara grupper man är medlem i som aktiv grupp.

DEL B - Körning 2:

Läs docs/korning-2.md och gör den. Tillägg:
- Importskriptet läser SUPABASE_SECRET_KEY och VITE_SUPABASE_URL ur .env.local. Nyckeln får aldrig skrivas ut, loggas eller importeras i src/.
- Kör npm run import:check först. Går den igenom, kör npm run import och redovisa antal rader per tabell. Väntat resultat: places 54, place_facts 103, place_items 186, compendium_items 120, ideas 73, gift_tips 45, bucket_catalog 93. Skiljer sig något: stanna och redovisa, rätta inte innehållet själv.
- Filerna i content/ är UTF-8. Läs dem som UTF-8 och kontrollera att å, ä och ö är rätt i databasen efter importen (till exempel platsen Borås).

Regler: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block och förklarar varför. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md.

Avsluta med npm run build, npm run typecheck och npm test, gör en git commit med meddelandet "Körning 2: karta och innehåll", och skriv en slutrapport med rubrikerna: Klart, Inte klart, Importen (rader per tabell), Saknade textnycklar, Det här behöver Hugo göra.
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
