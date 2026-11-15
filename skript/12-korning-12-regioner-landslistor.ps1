# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '12 - Körning 12: regioner och landslistor'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 11 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'EFTER: npm run import, så att delstaterna hamnar i databasen'
  'Kartan: läget Regioner, tryck på en delstat och på ett svenskt landskap'
  'Anpassning: byt Vilka länder räknas och kontrollera siffrorna på Jag'
  'Smart månad: staplarna går att träffa på mobilen'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 11 är klara.

Körning 12: regioner på kartan och vilka länder som räknas

Nytt innehåll finns i content/: US.json har fått USA:s 50 delstater och Washington D.C. som platser (kind region, layer delstat, data.iso_3166_2 med koden, till exempel US-CA), _landlistor.json är ny, och textfilerna har 13 nya nycklar (587 per språk). Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten.

DEL A - regioner som kartlager

1. Nytt kartläge bredvid Ren, Upptäck, Terräng 3D och Smart månad: karta.lage.regioner. I det läget ritas regionerna i de länder som har platser med layer (i dag landskap i Sverige och delstat i USA) som egna ytor ovanpå landet, färgade efter status precis som länder. Ett tryck på en region öppnar samma bottenark som för ett land, med status och länk till regionens sida. Utanför de länderna ser kartan ut som i läget Ren. Är kartan utzoomad så att inga regioner syns visas texten karta.regioner.tom.

2. Geometri. Delstaterna: använd Natural Earth admin 1 (states and provinces, 1:50m, public domain), bara USA, kopplade via iso_3166_2. Lägg dem i en egen fil som laddas först när läget väljs, inte i huvudpaketet, och förenkla ytorna så att filen blir högst 300 kB. Sveriges landskap: kontrollera först om projektet redan har ytor för landskapen. Har det inte det: Natural Earth har län, inte landskap, så bygg ingen egen gräns och gissa ingenting. Visa då landskapen som tryckbara punkter (44 px) på platsens koordinater i läget Regioner, och skriv i slutrapporten att ytor saknas. Lägg till källan i Kartans källor.

3. Koordinaterna för delstaterna i US.json är ungefärliga. Räkna inte om dem i innehållsfilen. Etiketter och inzoomning ska utgå från ytan när den finns.

4. Regionernas status sparas som för andra platser (place_status med platsens id). Min karta, Vår karta och en medlems karta fungerar som för länder. En region som är besökt gör inte landet besökt automatiskt och tvärtom: ändra ingenting i hur länder räknas.

5. På landssidan för ett land med regioner: en rad under rubriken karta.regioner.i-landet med lagrets namn (karta.regioner.landskap eller karta.regioner.delstat), räknaren karta.regioner.antal och en lista där varje region går att öppna och bocka av. I Vi/Jag-siffrorna: lägg till vi.siffror.delstater bredvid vi.siffror.landskap, bara när minst en delstat är besökt.

6. Bucketmålen med checklist { type: platser, parent_id, layer } ska fungera för delstaterna utan ändring. Kontrollera det med ett test.

DEL B - vilka länder räknas

7. content/_landlistor.json innehåller fn (193 landskoder) och fn_observatorer (2). Läs in filen vid bygget och kontrollera i import:check att varje kod finns bland appens länder, att fn har 193 unika koder och att listorna inte överlappar.

8. Ny inställning under Anpassning, under språkvalet: rubriken landlista.rubrik med hjälptexten landlista.hjalp och tre val: landlista.fn, landlista.fn-plus och landlista.alla, där {totalt} är antalet länder i respektive lista (193, 195 och antalet länder i appen). Förvalt är landlista.alla, så att inget ändras för den som inte väljer. Valet sparas som språkvalet: lokalt och i profiles.settings.

9. Valet styr nämnaren och vad som räknas överallt där länder räknas: siffrorna på Jag/Vi, procent av världen, kontinenträkningen, märken, bucketmål av typen antal med metric countries_visited eller continents_visited, checklistan besokta-lander och Wrapped. Kartan visar alltid alla länder och det går alltid att sätta status på alla. Ett besökt land som inte ingår i vald lista räknas inte, och på landets sida visas då den lilla märkningen landlista.utanfor. Samla logiken i en funktion som allt annat använder, och skriv enhetstester för de tre listorna.

10. I gruppläge gäller varje medlems eget val för den egna räkningen. I Vår karta och gemensamma siffror gäller valet hos den som tittar.

DEL C - smått

11. Staplarna i Smart månad är för smala att träffa på mobil. Gör raden under diagrammet (månadens bokstäver) till en del av samma knapp, så att träffytan blir hela kolumnens höjd, och låt svep åt vänster och höger över diagrammet byta månad.

Röktestet: välj läget Regioner, zooma till USA, tryck på Kalifornien och sätt Besökt, kontrollera räknaren på USA:s sida. Byt landlista till FN:s medlemsländer och kontrollera att nämnaren på Jag blir 193, byt tillbaka.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Kör inte npm run import eller import:images mot databasen.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 12: regioner och landslistor" och skriv slutrapporten innan du avslutar turen. Vänta inte på bakgrundsjobb. Rubriker: Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
