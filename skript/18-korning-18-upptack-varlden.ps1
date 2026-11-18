# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '18 - Körning 18: Upptäck, resten av världen'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 17 ska vara avslutad och incheckad först.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'FÖRE: Körning 17 ska vara körd och incheckad'
  'EFTER: npm run import, så att de nya platserna hamnar i databasen'
  'Upptäck: välj Asien och Mycket billigt, Bangkok ska finnas i listan'
  'Öppna Singapore: Kuala Lumpur och George Town står som billigare alternativ'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 17 är klara.

Körning 18: Upptäck, resten av världen

Ändrat innehåll finns i content/: _upptack.json har 71 nya lätta platser utanför Europa (140 totalt, 62 alternativ) och textfilerna har 8 nya nycklar (730 per språk) och en ändrad text (upptack.kalla). Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten. Ingen databasändring behövs.

1. Nytt i _upptack.json. Läs _om, särskilt niva_varlden.
   - Nytt fält på vissa platser: basis med värdet icp. Saknas fältet gäller Eurostat som förut.
   - Nya fält på toppnivå: pli_world (Världsbankens index per land, världen = 100) och pli_world_year.
   - Nya värden i tags (djurliv, dykning, tempel, oar) och climates (tropiskt, subtropiskt, oken).
   - existing har fått US-new-york och AU-sydney.
   Uppdatera valideringen i import:check: tillåt de nya fälten, kräv att en plats med basis icp har sitt land i pli_world och att en plats utan basis har sitt land i pli_restaurants_hotels, och kontrollera level_rule mot rätt regel (gränserna står i _om). Uppdatera docs/FORMAT.md.

2. Källraden på en lätt plats sida: har platsen basis icp visas upptack.index.varlden ({plats} är landets namn, {antal} landets värde i pli_world, {ar} är pli_world_year) i stället för upptack.index. level_note visas som förut.

3. Importen lägger till de länder som saknar landsfil på samma sätt som i Körning 15. Skriv i slutrapporten hur många länder det blir och om något land saknas bland appens länder.

4. Filtren i Upptäck: världsdel och land får nu fler värden. Kontrollera att filtret på världsdel visar alla sex bebodda världsdelar, att listan med länder går att söka i när den har fler än tjugo värden (använd samma sökfält som i kartans fokusval, inga nya texter behövs), och att klimat och typ av resa visar de nya värdena. Med 140 platser: visa de första 30 korten och ladda fler när man rullar, utan att antalet i upptack.antal ändras.

5. Lätta platser på södra halvklotet har bästa månader som går över årsskiftet (till exempel 11, 12, 1, 2). Kontrollera att upptack.kort.basta skriver dem i den ordning de står i filen och att månadsfiltret matchar dem.

6. Enhetstester: regeln för icp och för Eurostat, källraden för båda, en plats med månader över årsskiftet, laddningen av fler kort. Röktestet: välj världsdelen Asien och upptack.pris.1 och kontrollera att Bangkok finns i listan och Tokyo inte gör det, öppna Singapore och kontrollera att Kuala Lumpur står i alternativrutan och att källraden nämner Världsbanken.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 18: Upptäck, resten av världen" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
