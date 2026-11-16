# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '13 - Körning 13: säsonger i Smart månad'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 12 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'EFTER: npm run import, så att säsongerna hamnar i databasen'
  'Island: välj juli i Smart månad, Lunnefåglar ska stå under I säsong'
  'Island: välj december, Norrsken och Isgrottor men inga lunnefåglar'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 12 är klara.

Körning 13: säsonger i Smart månad

Nytt innehåll finns i content/: 13 landsfiler har fått ett nytt fält, och textfilerna har 3 nya nycklar (590 per språk). Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten.

1. Nytt fält i places.data: seasons. Det kräver ingen databasändring. Form:
   [ { "name": "text", "from": 1-12, "to": 1-12, "text": "text", "source": "url" } ]
   from och to är månadsnummer. Är from större än to går säsongen över årsskiftet (11 till 3 betyder november till mars). from lika med to betyder en enda månad. text och source får saknas. Lägg kontrollen i import:check (name, from och to krävs, heltal 1-12, source måste vara en http-adress när den finns) och beskriv fältet i FORMAT.md. Fältet får stå i own_judgment.

2. I rutan Smart månad, när en månad är vald: mellan månadens text och rubriken smart.handelser.rubrik visas rubriken smart.sasonger.rubrik med de säsonger som pågår den månaden, i filens ordning. Varje rad: namnet i fetstil, perioden med korta månadsnamn från Intl efter APP_LOCALE via smart.sasong.period (bara månadens namn när from är lika med to), texten under när den finns, och källan som länk med domännamnet (smart.handelser.kalla) när den finns. Pågår ingen säsong den månaden visas inte rubriken. Har platsen seasons men inga month_notes ska staplarna ändå gå att trycka på och rutan visa säsongerna.

3. Under varje stapel som har minst en pågående säsong visas en liten prick, 6 px, i dämpad färg, mellan stapeln och månadens bokstav. Pricken är dekor (aria-hidden). Stapelns aria-label får tillägget smart.sasong.aria med antalet, efter texten från smart.manad.betyg.

4. Samma säsonger visas på resans sida i Planera, när resan har en plats med seasons och ett datum: under platsens namn en rad per säsong som pågår under resans månader, med namn och period. Ingen ny rubrik behövs där, använd smart.sasonger.rubrik.

5. Enhetstester: säsong över årsskiftet, säsong på en månad, månad utan säsong, plats utan month_notes men med seasons, och valideringen. Röktestet: öppna Island, välj juli i Smart månad och kontrollera att Lunnefåglar står under I säsong, välj december och kontrollera att Lunnefåglar inte står där men Norrsken gör det.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Kör inte npm run import eller import:images mot databasen.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 13: säsonger" och skriv slutrapporten innan du avslutar turen. Vänta inte på bakgrundsjobb. Rubriker: Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
