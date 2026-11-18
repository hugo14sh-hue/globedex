# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '20 - Körning 20: innehåll på engelska, del 1'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 19 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'FÖRE: SQL-blocket från chatten ska vara kört i Supabase'
  'EFTER: npm run import, så att de engelska texterna hamnar i databasen'
  'Byt språk till engelska: Upptäck, bucketlistan och nya packlistor är på engelska'
  'Städer och länder visas på svenska tills deras filer är översatta'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 19 är klara.

Körning 20: innehållet på engelska, del 1

Ny mapp finns: content/en/ med fyra filer (_upptack.json, _bucket.json, _packlista.json, _innan-avresa.json). Landsfilerna på engelska kommer senare, en i taget, i samma mapp. Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten. Textfilerna är oförändrade (737 nycklar per språk).

Databasen: Hugo har redan kört SQL-blocket nedan. Lägg in det i docs/schema.sql och gör inga andra databasändringar.

   alter table public.places           add column if not exists en jsonb;
   alter table public.place_facts      add column if not exists en jsonb;
   alter table public.place_items      add column if not exists en jsonb;
   alter table public.compendium_items add column if not exists en jsonb;
   alter table public.bucket_catalog   add column if not exists en jsonb;
   alter table public.ideas            add column if not exists en jsonb;
   alter table public.gift_tips        add column if not exists en jsonb;

Principen: svenskan i content/ är originalet. content/en/ innehåller bara översatta texter, aldrig siffror, id:n, datum, koordinater eller källor. Kolumnen en innehåller de engelska texterna för raden, med samma fältnamn som den svenska raden. Saknas en engelsk text visas den svenska, fält för fält. Inget i appen får gå sönder av att en fil eller ett fält saknas i content/en/.

1. Formatet i content/en/. Beskriv det i docs/FORMAT.md.
   - en/_upptack.json: places { id: { why, name (bara när namnet skiljer sig), level_note (bara när den svenska platsen har en) } }, existing { id: { why } }, alternatives { "<for>><place>": why }.
   - en/_bucket.json: { id: { name, season, where_text, checklist_items } }. checklist_items finns bara för delmål av typen delar och har samma antal och ordning som items i den svenska filen.
   - en/_packlista.json: groups { svenskt gruppnamn: engelskt } och items { id: { title } }.
   - en/_innan-avresa.json: items { id: { title, hint } }.
   - en/<landskod>.json (kommer senare, bygg stödet nu): samma toppnycklar som landsfilen, men som objekt med id som nyckel:
     places { id: { name, data } }, facts { id: { title, summary, body } }, items { id: { name, summary, body } }, compendium { id: { name, hint } }, ideas { id: { title, body, duration } }, gifts { id: { name, body } }.
     data under places speglar den svenska data-strukturen men innehåller bara textfälten: best_text, flight_tips, day_budget_note, stay [ { name, text } ], areas [ { name, text } ], transport [ { mode, text } ], month_notes [ 12 texter ], events [ { name, text } ], seasons [ { name, text } ], prices { summary, tips [ ], rows [ { note } ] }. Listor har samma längd och ordning som i den svenska filen, och en post utan text är ett tomt objekt.

2. Validering i import:check för content/en/: okända id:n, okända fält, listor med fel längd, tomma texter, platshållare som inte finns i den svenska texten, och ett fält som finns på engelska men saknas på svenska. Saknade översättningar är inte fel: skriv i stället ut en sammanställning per fil med antal översatta texter av totalt antal.

3. Importen skriver kolumnen en för de sju tabellerna. För places läggs de engelska texterna från _upptack.json (why, level_note, alternativens why) och från landsfilen ihop i samma en-objekt. Saknas engelska för en rad sätts en till null. Importen ska gå att köra om utan att något dubbleras.

4. Appen. Lägg ett enda ställe, till exempel en funktion i src/lib, som väljer text för en rad och ett fält efter valt språk och faller tillbaka på svenskan. Använd den överallt där innehåll ur de sju tabellerna visas: kartan, platssidor, Smart månad, priser, säsonger, händelser, Idag, Listor, bucketlistan, kompendiet, presenttips, Upptäck, sök och Wrapped. Sök ska hitta platser på båda språken oavsett valt språk.
   Namn på länder kommer som i dag från webbläsarens namn på valt språk och från land.<id>.

5. Packlistan och Innan avresa kopieras till resan när den skapas. Nya resor får texterna på det språk som är valt när resan skapas. Befintliga resor ändras inte. Gruppnamnen i packlistan översätts med groups när raden visas, om gruppen är en av de fem från mallen.

6. Märken, bucketlistans kategorier och andra texter som redan ligger i _texter.json rörs inte.

7. Enhetstester: fallback fält för fält, en plats med engelska från båda källorna, listor i data (månad 3 på engelska, månad 4 saknas), sök på båda språken, valideringens fel och sammanställning, ny resa på engelska. Röktestet: byt till engelska, öppna Upptäck och kontrollera att kortet för Lisbon har engelsk text och engelskt namn, öppna bucketlistan och kontrollera en engelsk rad, öppna en svensk stad utan översättning och kontrollera att den svenska texten visas, och byt tillbaka till svenska efteråt.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en till, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 20: innehåll på engelska, del 1" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
