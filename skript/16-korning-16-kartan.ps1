# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '16 - Körning 16: kartan'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 15 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'EFTER: npm run import, så att texterna hamnar i databasen'
  'Kartan: rullgardinen har världsdelar och länder, välj Asien'
  'Helskärm öppnas och stängs, också i appen på telefonen'
  'Anpassning: byt färg på Vill åka och se den på kartan'
  'Datorn: menyn står till vänster och kartan fyller ytan'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 15 är klara.

Körning 16: kartan

Ändrat innehåll finns i content/: textfilerna har 29 nya nycklar (720 per språk) och ingress.upptack är kortad, och _upptack.json har fått fältet why på de 13 städerna under existing. Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten. Ingen databasändring behövs: alla nya val sparas i profiles.settings, per användare.

1. Upptäck, efter Körning 15: tillåt fältet why under existing i valideringen (en mening, samma regler som för places) och visa det på korten för de befintliga städerna. Uppdatera docs/FORMAT.md. Uppdatera också beskrivningen av flikarna i CLAUDE.md så att den stämmer med appen (sex flikar): det är den enda ändringen du får göra i den filen.

2. Kartans fokus. Valet mellan karta.lage.europa och karta.lage.varlden ersätts av en rullgardin (karta.fokus.aria). Innehåll, i ordning: karta.fokus.varlden, rubriken karta.fokus.rubrik.varldsdelar med de sex bebodda världsdelarna (namn från kontinent.<kod>), rubriken karta.fokus.rubrik.lander med ett sökfält (karta.fokus.sok) och appens länder i bokstavsordning på valt språk. Ingen träff: karta.fokus.inga. Ett val flyttar kartan så att världsdelen eller landet fyller kartytan, med mjuk rörelse (ingen rörelse vid reducerad rörelse). Valet sparas och står i adressen. Förvalt är Europa, som i dag. Väljer man ett land som har regioner i appen (Sverige, USA) ändras inte lagret: det styrs som förut av läget Regioner. Rullgardinen ska gå att använda med tangentbord och skärmläsare.

3. Helskärm. En knapp på kartan (karta.helskarm.oppna) låter kartan fylla hela fönstret, över flikraden och sidhuvudet. I helskärm: knappen karta.helskarm.stang uppe till höger (Escape stänger också, och fokus går tillbaka till knappen som öppnade), rullgardinen från punkt 2, lägesväljaren, växlingen Min karta och Vår karta, knappen för landlistan, och en panel med rubriken karta.helskarm.panel som innehåller förklaringen till färgerna och listan från punkt 6. På mobil är panelen ett ark som dras upp från nederkanten, på 900 px och bredare en kolumn till höger som går att fälla in. Använd inte webbläsarens Fullscreen API: det ska vara en vy i appen, så att det fungerar i installerad PWA på iPhone. Respektera safe-area. Helskärmsläget står i adressen, så att bakåt stänger det.

4. Egna färger. Under Anpassning, rubriken farger.rubrik med texten farger.hjalp. En rad per status som har färg på kartan: bor, har bott, besökt på egen hand, besökt tillsammans, båda var för sig, bara den andra, planerad, vill åka och mellanlandat, med de namn som redan används i förklaringen. Varje rad har en färgväljare (aria-label farger.valj) och farger.aterstall.en. Längst ner farger.aterstall. Bekräftelse: farger.sparat.
   Färgerna sparas per användare i profiles.settings och går före palettens färger, i både ljust och mörkt tema, på kartan, i förklaringen och överallt där statusfärgen visas. En rad utan eget val följer paletten som i dag.
   Ligger en vald färg närmare en annan statusfärg än gränsen som färgtestet använder (10) visas farger.varning på raden ({status} är den andra statusens namn). Det är en upplysning och stoppar inte valet.

5. Kartans utseende. Under Anpassning och i helskärmspanelen: rubriken kartstil.rubrik med valen kartstil.auto (förvalt), kartstil.ljus och kartstil.mork. Det styr kartans egen stil, alltså hav, land utan status, gränser och etiketter, oberoende av appens tema. Finns det ingen mörk kartstil i dag: ta fram en ur samma OpenFreeMap-källa, med samma lager, och kontrollera att alla statusfärger går att skilja från den mörka bakgrunden med färgtestets gräns. Skriv i slutrapporten vilka färger du valde för hav och land.

6. Listan över platser. Där appen i dag listar markerade länder och städer intill kartan (och i helskärmspanelen) ska listan ha rubriken karta.lista.rubrik och vara grupperad per världsdel: världsdelens namn och antal länder (karta.lista.lander eller karta.lista.lander.en), sedan länderna i bokstavsordning med statusfärg och status. Ett land som har markerade städer visar karta.lista.stader eller karta.lista.stader.en och går att fälla ut (aria-label karta.lista.falla-ut och karta.lista.falla-in), och städerna visas indragna under landet med sin status. Världsdelarna går att fälla ihop var för sig.
   Ovanför listan ett val (karta.lista.visa.aria) med en knapp per status, alla tända från början. En släckt status döljs i listan och tonas ner på kartan till färgen för ingen status. Valet sparas. Blir listan tom: karta.lista.tom. Finns ingen sådan lista i dag: lägg den under kartan på mobil och i panelen i helskärm, och skriv det i slutrapporten.

7. Större skärmar, del 1: ramen och kartan. Mobilen är fortsatt utgångspunkten och ska se ut som i dag.
   - Från 900 px: flikraden flyttar från nederkanten till en smal meny till vänster med ikon och text. Innehållet får en största bredd och centreras.
   - Kartfliken från 900 px: kartan fyller ytan till höger om menyn i hela höjden, och förklaringen och listan ligger i en kolumn till höger om kartan, som går att fälla in.
   - Ark som dras upp från nederkanten på mobil (platsens ruta, statusvalet) visas från 900 px som en panel till höger eller en centrerad dialog, välj det som passar varje ark och var konsekvent.
   - Kontrollera 390, 768, 1024 och 1440 px. Ingen sida får rulla i sidled på någon av bredderna.
   De övriga flikarnas innehåll anpassas i nästa körning: gör dem inte om nu, men de ska inte gå sönder i den nya ramen. Skriv i slutrapporten vilka sidor som ser sämst ut på 1440 px, så att jag kan beställa dem i rätt ordning.

8. Enhetstester: fokusvalet (världsdel och land ger rätt utsnitt), egna färger går före paletten och återställs, varningen för närliggande färger, kartstilens tre val, grupperingen per världsdel med städer under land, släckta statusar. Röktestet: välj Asien i rullgardinen, öppna och stäng helskärm med Escape, byt färg på vill åka och kontrollera den i förklaringen, återställ, släck besökt och kontrollera listan. Lägg till ett steg på 1440 px som kontrollerar att menyn står till vänster och att sidan inte rullar i sidled. Städa efteråt så att testkontots inställningar är som före.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 16: kartan" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
