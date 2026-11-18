# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '17 - Körning 17: större skärmar'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 16 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'EFTER: npm run import, så att de två nya texterna hamnar i databasen'
  'Datorn: Upptäck har filtren till vänster och korten i rutnät'
  'Datorn: Vi har fyra sifferrutor på en rad'
  'Mobilen ser ut som förut på alla sidor'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 16 är klara.

Körning 17: större skärmar, del 2

Textfilerna i content/ har 2 nya nycklar (722 per språk). Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten. Ingen databasändring behövs. Mobilen (under 900 px) ska se ut exakt som i dag: allt nedan gäller från 900 px och uppåt om inget annat står.

1. Efter Körning 16, listan Platser:
   - Raden under ett land visar karta.lista.stader eller karta.lista.stader.en bara när allt under landet är städer. Finns landskap eller delstater med: använd karta.lista.platser eller karta.lista.platser.en.
   - Ett land utan egen status som har markerade platser under sig visar texten karta.status.ej-satt och färgen för ingen status.
   - Gruppens namn med länken som försvann från Karta från 900 px läggs längst ner i vänstermenyn, på alla sidor.

2. Ramen. Innehållets största bredd höjs från 760 px till 1200 px på sidorna nedan. Löpande text (stycken, ingresser, kompendium) ska aldrig bli bredare än 70 tecken per rad: begränsa textblocken, inte sidan. Använd samma brytpunkter överallt: 900 px och 1200 px.

3. Landssidan och stadssidan (till exempel /karta/SE). Raden Missa inte får inte klippas vid kanten: låt den radbrytas till ett rutnät från 900 px. Från 1200 px två kolumner: till vänster det som beskriver platsen (bild, fakta, Smart månad, priser, säsonger), till höger det man gör (statusvalet, saker att bocka av, kompendium, idéer). Ordningen i koden ska vara densamma som på mobil, så att läsordningen för skärmläsare inte ändras.

4. Vi. Sifferrutorna i fyra kolumner från 900 px, med en största bredd per ruta så att de inte blir utdragna. Märkena i fem kolumner från 900 px och sex från 1200 px. Wrapped centreras med samma bredd som på mobil.

5. Resor. Listan med resor som kort i två kolumner från 900 px och tre från 1200 px. På en resas sida från 1200 px: översikten (plats, datum, budget, säsonger) i en fast kolumn till vänster som följer med när man rullar, och resans delar (planering, packlista, kassa, inköp, bokningar) till höger.

6. Listor. Listorna och bucketlistan som kort i två kolumner från 900 px och tre från 1200 px. Inne i en lista: två kolumner med punkter från 1200 px när listan har fler än tolv punkter, annars en.

7. Idag. Korten i två kolumner från 900 px och tre från 1200 px. Budgetraden och filtren ligger kvar överst i full bredd.

8. Upptäck. Från 900 px ligger filtren i en kolumn till vänster som följer med när man rullar, och korten i ett rutnät till höger: två kolumner från 900 px, tre från 1200 px. Antal och sortering står ovanför korten. Under 900 px som i dag.

9. Jag och Gruppen: formulär och inställningar får en största bredd på 640 px och centreras. Anpassning: färgraderna och valen i två kolumner från 1200 px.

10. Allmänt på större skärmar: hover-lägen på allt klickbart, synlig fokusring överallt, och dialoger som stängs med Escape och klick utanför. Tryckytor ska vara kvar på minst 44 px. Inga nya funktioner.

11. Röktestet: utöka steget som kontrollerar sidled-rullning på 390, 768, 1024 och 1440 px så att det också öppnar en landssida, en resa, en lista och Upptäck med ett filter valt. På 1440 px: kontrollera att Upptäck har filtren till vänster och minst tre kort på en rad, att Vi har fyra sifferrutor på en rad och att raden Missa inte på /karta/SE inte klipps. Ta skärmdumpar av alla åtta sidorna på 1440 px och 768 px till en mapp som inte checkas in, och skriv sökvägen i slutrapporten så att jag kan titta på dem. Kör tillgänglighetstestet på 1440 px också.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 17: större skärmar" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
