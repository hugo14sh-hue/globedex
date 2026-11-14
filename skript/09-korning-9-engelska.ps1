# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '09 - Körning 9: engelska'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 8 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'Anpassning: byt till English och kontrollera flikarna, inloggningssidan och datum'
  'Samlingsbok: växla mellan Min bok och Vår bok'
  'Byt tillbaka till svenska och kontrollera att allt är som förut'
  'build, typecheck, test och test:e2e är gröna'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md och docs/schema.sql innan du gör något. Körning 1 till 8 är klara.

DEL A - efter Körning 8:

1. SQL-blocket från din slutrapport i Körning 8 är kört i Supabase, oförändrat (finds.found_on får vara tom). Uppdatera docs/schema.sql.

2. Samlingsboken förblir personlig. Lägg till en växling överst i Samlingsbok, som på kartan: Min bok och Vår bok (texterna karta.visa.min och karta.visa.var räcker inte här, använd de nya samling.visa.min, samling.visa.var och samling.visa.medlem med {namn}). Vår bok visar ett kort som hittat om någon i den aktiva gruppen har hittat det, och visar vem. Bara egna fynd går att lägga till och ta bort. I solo visas ingen växling. Kontrollera att RLS låter gruppmedlemmar läsa varandras fynd och inget mer. Behövs en ändring: ge mig ett SQL-block.

3. Samlingsboken ska visa vad korten är, även innan de är hittade. I dag står det ett frågetecken eller samling.okant på kort som inte är hittade. Visa i stället alltid kortets namn, ikon, sällsynthet och ledtråd (hint), både i Kort, i bottenarket och i Markera flera. Ett kort som inte är hittat skiljs från ett hittat med dämpad färg och utan bock, inte genom att namnet döljs, och kontrasten ska fortfarande klara 4,5:1. samling.okant används inte längre som namn. I vyn Kompendium ska ett tryck på en kategori fälla ut kategorins kort direkt i listan, med namn och en ruta att bocka av, i stället för att hoppa till Kort. Ett tryck på ett kort öppnar samma bottenark som i Kort. Uppdatera röktestet.

DEL B - Körning 9: engelska i gränssnittet

1. content/_texter.en.json finns nu, med samma nycklar, platshållare och märken som content/_texter.json (528 nycklar, 24 märken). Skriv ett enhetstest som kontrollerar att varje nyckel i den svenska filen finns i den engelska med samma platshållare och samma form (sträng eller tre stilar), och tvärtom. import:check ska köra samma kontroll.

2. Språkval under Anpassning, direkt under Språkstil: rubriken sprak.rubrik och valen sprak.sv och sprak.en (de två namnen visas alltid på sitt eget språk). Valet sparas som inställningarna för tema: lokalt, så att rätt språk visas direkt vid start, och i profiles.settings. Är inget val gjort: svenska om webbläsarens språk börjar med sv, annars engelska. Inloggningssidan följer samma regel.

3. t() läser texterna för valt språk. Den engelska filen laddas bara när engelska är valt, och den ska inte ligga i huvudpaketet. Saknas en nyckel på engelska används den svenska. Språkstilarna (neutral, lekfull, romantisk) fungerar likadant på båda språken.

4. APP_LOCALE blir dynamisk: sv-SE eller en-GB efter valt språk. Den styr som i dag datum, tal, valuta, restid, sortering, html lang och landsnamn från Intl.DisplayNames. Belopp i kronor visas som SEK på engelska.

5. Innehållet ur databasen (platser, fakta, listpunkter, kompendium, bucketkatalog, idéer, presenttips) finns bara på svenska ännu. När engelska är valt visas texten sprak.innehall-svenska en gång under språkvalet, inte på varje sida. Bygg ingen översättning av innehållet och inget fält för det. Packlistans och Innan avresas förslag kommer också på svenska tills vidare.

6. Röktestet: lägg till ett steg som byter till engelska, kontrollerar att flikarna heter Map, Today, Lists, Trips och att en knapp på inloggningssidan är engelsk efter utloggning, och byter tillbaka till svenska.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md.

Avsluta med npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 9: engelska" och skriv slutrapporten innan du avslutar turen. Vänta inte på bakgrundsjobb. Rubriker: Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
