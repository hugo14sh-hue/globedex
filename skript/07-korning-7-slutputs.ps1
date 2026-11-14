# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '07 - Körning 7: slutputs och driftsättning'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning med ny del av appen.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'Slutrapporten har Röktestet, Lighthouse före och efter och Säkerhet per tabell'
  'build, typecheck och test är gröna'
  'npm run dev: topplisten med loggan syns på Karta, och varje idé i Idag visar budget'
  'Stäng av nätverket i webbläsaren och kontrollera att en kommande resa går att läsa'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md och docs/schema.sql innan du gör något. Körning 1 till 6 är klara.

DEL A - efter Körning 6:

1. Båda SQL-blocken från din slutrapport i Körning 6 är körda i Supabase, oförändrade (vault_items.salt och de fyra reglerna på reviews), plus en rad till: packing_items har fått kolumnen packed_at timestamptz. Uppdatera docs/schema.sql så att filen motsvarar databasen. Sätt packed_at när en rad bockas av och nolla den när bocken tas bort, och låt märket Färdigpackad använda den.

2. Valvets kod ska vara minst 8 tecken (MIN_CODE = 8). valv.kort-kod har redan {antal}.

3. Texterna valv.kod, valv.last och land.regler-for-dig.fodelsedatum finns nu. Använd dem i stället för nödlösningarna.

4. Idag: visa en rekommenderad budget på varje idé, direkt under titeln både i Slumpa, Nära och Sparade. Texten hämtas ur idag.budget.gratis, idag.budget.billigt, idag.budget.medel eller idag.budget.dyrt efter idéns cost_level, med etiketten idag.budget.rubrik. Idéer utan cost_level visar ingen budget. Allt utom gratis märks med knapp.uppskattning.

5. Topplist: lägg en smal list överst på fliken Karta med märket (docs/logo/globedex-symbol-liten.svg, mörk variant i mörkt läge) och APP_NAME i rubrikfonten till vänster, och gruppens namn som en knapp till höger som leder till sista fliken (aria-label från topp.till-gruppen med {namn}). Höjd högst 52 px plus safe-area-inset-top. Listen ligger över kartan utan att flytta kartans knappar ur bild. På de andra flikarna visas ingen logga, där räcker sidans rubrik. Loggans färger är fasta.

6. Tillbaka till samma ställe: när man öppnar en undersida (plats, resa, bucketpunkt, samling) och går tillbaka ska listan stå kvar där man var, inte högst upp. Det gäller både webbläsarens bakåtknapp och appens egen tillbakaknapp, och även valda vyer och filter på sidan (segment, kategori, sökord). Ny navigering framåt börjar högst upp. Skriv ett test.

7. Bucketlist med delmål. SQL är kört: bucket_catalog har kolumnen checklist jsonb och bucket_items har kolumnen parts jsonb. content/_bucket.json har nu fältet checklist på sex punkter, i tre former:
- { "type": "platser", "place_ids": [...] } eller { "type": "platser", "parent_id": "SE", "layer": "landskap" }: en rad per plats. Raden bockas av automatiskt när platsen har status besökt, bor eller har bott, och går inte att bocka av för hand (visa bucket.delar.auto). { "type": "platser", "source": "besokta-lander" } listar de länder som har status besökt, och där bockar man av själv.
- { "type": "antal", "metric": "countries_visited" eller "continents_visited", "target": N }: en stapel med framsteg ur samma uträkning som Siffror.
- { "type": "delar", "items": [titlar] }: en rad per titel som man bockar av själv.
Avbockningar som görs för hand sparas i bucket_items.parts som [{ "title", "done", "done_at" }]. Egna bucketpunkter kan få egna delmål med bucket.delar.ny. Punkten visar bucket.delar.framsteg i listan, och när alla delmål är klara frågar appen bucket.delar.alla-klara. Importskriptet ska läsa in checklist, FORMAT.md ska beskriva fältet och import:check ska validera det. Uppdatera docs/schema.sql. Kör inte importen själv, det gör Hugo.

8. Röktest i webbläsare. Fyra körningar är nu bara byggda och enhetstestade. Finns TEST_EMAIL och TEST_PASSWORD i .env.local: installera Playwright som dev-beroende och skriv npm run test:e2e som startar appen lokalt, loggar in med testkontot i en 390 px bred mobilvy och går igenom: kartan laddas och status sätts på ett land, landssidan för Nederländerna öppnas och en listpunkt bockas av, fyndet syns i samlingsboken, en punkt läggs till ur bucketkatalogen, en resa skapas i planeraren och en utgift läggs in, Idag slumpar en idé hemma och visar budget, Valvet skapas med en kod, en post sparas, Valvet låses och låses upp, en undersida öppnas långt ned i en lista och bakåt hamnar på samma ställe. Testet städar efter sig. Rätta de fel testet hittar och redovisa dem. Uppgifterna får aldrig skrivas ut, loggas eller checkas in. Saknas raderna: hoppa över punkten och skriv det överst i slutrapporten.

DEL B - Körning 7:

Läs docs/korning-7.md och gör den. Tillägg:
- Miljövariablerna i Vercel är VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY. SUPABASE_SECRET_KEY, TEST_EMAIL och TEST_PASSWORD läggs aldrig i Vercel.
- Inloggningen är e-post och lösenord utan mejlbekräftelse. När Hugo stänger av nyregistrering i Supabase ska Skapa konto ge texten allmant.registrering-stangd i stället för allmant.fel. Skriv i steg-för-steg-listan var inställningen finns och att den slås av när båda kontona är skapade.
- Offline: bokningar och packlista för kommande resor ska gå att läsa utan uppkoppling. Valvets chiffertext får cachas, klartext aldrig.
- Säkerhetsgenomgången: redovisa per tabell vad en inloggad användare utanför gruppen kan läsa och skriva, som en tabell i slutrapporten. Ge mig SQL-block för det som behöver rättas.
- Ikoner och favicon: använd globedex-favicon.svg för 16 till 32 px om den inte redan används.

Regler: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Driftsätt inte själv: jag kopplar Vercel.

Avsluta med npm run build, npm run typecheck och npm test (och npm run test:e2e om testkontot finns), gör en git commit med meddelandet "Körning 7: slutputs", och skriv en slutrapport med rubrikerna: Klart, Inte klart, Röktestet, Lighthouse före och efter, Säkerhet per tabell, Saknade textnycklar, Driftsättning steg för steg.
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
