# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '11 - Körning 11: smart månad, sök, bilder, ingresser'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 10 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'FÖRE körningen: SQL-blocket för place_items ska vara kört i Supabase'
  'EFTER: npm run import, sedan npm run import:images'
  'Monaco: tryck på juni i Smart månad, Formel 1 ska stå där'
  'Planera resa: sök i stället för rullista, och enhet på Hur länge'
  'Gullfoss har bild, Somaliland går att trycka på, ingress under flikrubrikerna'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 10 är klara och appen ligger på Vercel.

Körning 11: Hugos synpunkter efter test i skarp miljö

Nytt innehåll finns i content/: MC.json och IS.json är uppdaterade, och content/_texter.json och content/_texter.en.json har 20 nya nycklar (574 per språk). Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten.

1. SQL-blocket nedan är kört i Supabase. Uppdatera docs/schema.sql.
   alter table public.place_items add column if not exists wiki text, add column if not exists image_url text, add column if not exists image_credit text, add column if not exists image_license text, add column if not exists image_page text;

2. Smart månad ska förklara sig. Två nya fält i places.data, båda får saknas:
   - month_notes: lista med exakt 12 texter, januari först.
   - events: lista med { name, start, end, text, source }, datum som ÅÅÅÅ-MM-DD.
   Lägg kontrollen i import:check och beskriv fälten i FORMAT.md. I rutan Smart månad: har platsen month_notes visas texten smart.tryck under staplarna. Ett tryck på en månad markerar stapeln och visar under diagrammet månadens namn med betyget (smart.manad.betyg), månadens text och, under rubriken smart.handelser.rubrik, de händelser som börjar eller slutar i den månaden och inte har passerat: namn, datum som intervall, text och källan som länk (smart.handelser.kalla, visa domännamnet). Innevarande månad är förvald. Staplarna ska gå att nå med tangentbord och ha aria-label från smart.manad.betyg. Utan month_notes ser rutan ut som i dag.

3. Planera nästa resa, fältet Vart?: byt rullistan mot ett sökfält med förslag (combobox enligt WAI-ARIA). Platshållare resa.vart.sok. Förslagen visas i två grupper, resa.vart.lander och resa.vart.stader, och sökningen matchar början av varje ord, utan hänsyn till versaler och accenter (å, ä och ö ska ändå skilja sig från a och o). Landets flagga visas framför länder, och efter en stad står landets namn. Inga träffar: resa.vart.inga. Använd samma komponent överallt där man i dag väljer land eller plats i en rullista.

4. Planera nästa resa, fältet Hur länge?: i dag syns bara en siffra. Ta reda på i koden om värdet räknas som nätter eller dagar, i budget, packlista och datum. Visa enheten som fältets etikett: resa.langd.natter eller resa.langd.dagar. Skriv i slutrapporten vilken det blev och var värdet används.

5. Bilder på listpunkter. place_items har fått fälten wiki, image_url, image_credit, image_license och image_page. wiki kommer från innehållsfilerna i formen "en:Sidans titel". Lägg wiki i importen och i FORMAT.md, och se till att npm run import aldrig skriver över de fyra bildfälten.
   Nytt skript npm run import:images (körs med SUPABASE_SECRET_KEY, som import): för varje listpunkt med wiki och utan image_url hämtas sidans huvudbild från Wikipedias API (pageimages, 800 px bred), och från Commons API (imageinfo, extmetadata) upphovsperson, licens och filsidans adress. Spara bara bilder med licens CC0, Public domain, CC BY eller CC BY-SA. Rensa html ur upphovsnamnet. Skriv ut en lista över punkter som saknar sida, saknar bild eller har annan licens. Flaggan --force hämtar om alla. Skriptet får inte köras i den här körningen mot databasen, det gör Hugo.
   I appen: när en listpunkt har image_url visas bilden överst på punktens sida, 16:9, object-fit cover, loading lazy, med alt från bild.alt. Under bilden i liten text bild.kalla (eller bild.kalla.okand när upphov saknas) som länk till image_page. I listan visas en liten rund miniatyr till vänster om titeln när bild finns, annars som i dag. Bilderna laddas direkt från upload.wikimedia.org: uppdatera CSP om appen har en, och låt service workern cacha dem med en gräns på 60 bilder. Bygg ingen uppladdning av egna bilder, skriv den idén i docs/fas2.md.

6. Vita ytor på kartan. Somaliland visas som en egen vit yta som inte går att trycka på. Gå igenom kartdatat och lista i slutrapporten alla ytor som saknar matchande land i appen. Ytor som saknar egen ISO-kod ska räknas till det land de hör till enligt ISO 3166: Somaliland till SO och Nordcypern till CY. De färgas och öppnas som det landet. Lägg kopplingen i en liten tabell i koden med en kommentar, och skriv ett enhetstest.

7. Ingress under sidrubrikerna. Under rubriken på varje flik visas en kort text i dämpad färg: ingress.karta, ingress.idag, ingress.listor, ingress.resor, ingress.jag och ingress.vi (ingress.gruppen när gruppen har fler än två medlemmar). Den ska inte ta mer än två rader på 390 px. Har en flik ingen synlig rubrik i dag läggs texten överst i innehållet.

8. Röktestet: Monaco: tryck på juni i Smart månad och kontrollera att Formel 1 står under Händer då. Planera resa: skriv "mon" i sökfältet och välj Monaco. Kontrollera att ingressen syns på Idag. Enhetstester för sökningens matchning, month_notes och events i import:check och kopplingen av ytor till land.

Det här ingår INTE i körningen, skriv ingenting om det i koden: regioner och delstater som kartlager, och val mellan FN:s lista och hela landslistan. Det kommer i Körning 12.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Kör inte npm run import eller import:images mot databasen.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 11: smart månad, sök, bilder, ingresser" och skriv slutrapporten innan du avslutar turen. Vänta inte på bakgrundsjobb. Rubriker: Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
