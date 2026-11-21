# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '21 - Körning 21: städer i delade länder'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 20 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'EFTER: npm run import:check och sedan npm run import, så att London hamnar i databasen'
  'Öppna England: London ligger under Städer, och inresa, valuta och eluttag visas'
  'Öppna London: priserna visas i pund och i kronor'
  'Storbritanniens sida ser ut som förut, med de fyra delarna'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 20 är klara.

Körning 21: städer i delade länder

Ny fil finns: content/GB.json med landet GB och staden GB-eng-london, och content/en/GB.json med de engelska texterna. content/_valutor.json har fått GBP. Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten. Textfilerna är oförändrade (737 nycklar per språk). Inga databasändringar behövs.

Bakgrund: Storbritannien är ett delat land (content/_landlistor.json, fältet delade, Körning 19). Delarna GB-eng, GB-sct, GB-wls och GB-nir skrivs av importen som platser under GB. En stad i en landsfil kan inte ha en del som parent_id, eftersom valideringen bara känner till platserna i filerna. Därför gäller den här regeln från och med nu:

Regeln: en stad, region eller plats i ett delat land har landet som parent_id i filen (GB) och ett id som börjar med delens id och ett bindestreck (GB-eng-london hör till GB-eng). Appen räknar ut delen ur id:t. Lägg funktionen bredvid den övriga logiken för delade länder (src/lib/delade.ts) och använd den överallt nedan.

1. FORMAT.md: beskriv regeln under delade länder, med GB-eng-london som exempel.

2. Valideringen (npm run import:check): i ett delat land ska varje plats under landet ha ett id som börjar med en av delarnas id och ett bindestreck. Annars fel, med platsens id och vilka delar som finns. Sammanställningen visar antal platser per del.

3. Delens sida (England): visa delens städer, regioner och platser på samma sätt som ett vanligt lands sida visar sina. I dag finns bara London. Delar utan platser ser ut som i dag.

4. Fakta och presenttips som ligger på landet (GB: inresa, valuta, eluttag, presenter) visas på varje dels sida, på samma sätt som ett vanligt land visar sina. Kompendiets rader för GB hör till landet som i dag.

5. Stadens sida (London): brödsmulor och tillbaka-länk går till delen (England), inte till Storbritannien. Där appen visar vilket land en plats ligger i (Upptäck, sök, listor, resor, händelser, Idag, Wrapped) visas delens namn (land.GB-eng) för platser som hör till en del.

6. Kartan och statistiken: London räknas till England i allt som räknar per land när delningen är på, och till Storbritannien när den är av, enligt samma regel som delarna själva följer sedan Körning 19. Stadens egen status sätts som för andra städer. Sätts en status på London ändras inte Englands status automatiskt, om inte appen redan gör så för vanliga länder: följ då samma beteende.

7. Storbritanniens sida ändras inte: de fyra delarna visas som i dag, utan statusväljare.

8. Priserna i London står i GBP. Kontrollera att pund visas rätt med kursen i _valutor.json, på samma sätt som DKK och PLN.

9. Enhetstester: delen ur id (GB-eng-london ger GB-eng, GB ger ingen, SE-stockholm ger ingen), valideringens fel för en plats utan delens id, delens sida med och utan platser, landets fakta på delens sida, landsnamnet för London på båda språken. Röktestet: öppna England, kontrollera att London finns under städer och att inresefaktan visas, öppna London och kontrollera att ett pris visas i pund, gå tillbaka med tillbaka-länken och kontrollera att du hamnar på England.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 21: städer i delade länder" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.

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
