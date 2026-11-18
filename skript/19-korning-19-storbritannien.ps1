# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '19 - Körning 19: Storbritanniens fyra länder'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 18 ska vara avslutad och incheckad först.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'FÖRE: Körning 18 är incheckad och filerna i skript\19-innehall är kopierade till content'
  'EFTER: npm run import, så att de fyra länderna hamnar i databasen'
  'Kartan: England, Skottland, Wales och Nordirland går att öppna var för sig'
  'Vi: antalet länder är av 240 när listan Alla är vald'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 18 är klara.

Körning 19: England, Skottland, Wales och Nordirland som egna länder

Ändrat innehåll finns i content/: _landlistor.json har fått fältet delade, och textfilerna har 7 nya nycklar (737 per språk). Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten.

1. _landlistor.json, fältet delade: { "GB": ["GB-eng", "GB-sct", "GB-wls", "GB-nir"] }. Läs _om. Lägg valideringen i import:check (landet finns bland appens länder, delarnas id börjar med landets kod och har namn under land.<id> på båda språken) och beskriv fältet i docs/FORMAT.md. Bygg det allmänt, så att fler länder kan delas senare genom att bara ändra filen.

2. Importen skapar de fyra delarna som platser av typen land, med GB som förälder och Europa som världsdel, på samma sätt som länderna utan landsfil. Namnet kommer från land.<id> på valt språk. Går det inte utan databasändring: ge mig ett SQL-block och skriv varför.

3. Kartdata. Ta fram gränserna för de fyra delarna ur Natural Earth, Admin 0 map units (public domain), i samma detaljnivå och format som appens övriga länder, och lägg dem i public/geo/ med ett skript i scripts/ som går att köra om. Ange källan där appen redan anger kartkällor.

4. Nytt val under Vilka länder räknas, både under Anpassning och i knappen på kartan: en brytare med texten landlista.delade.val och hjälptexten landlista.delade.hjalp. Förvalt är på, också för befintliga användare. Valet sparas i profiles.settings och gäller tillsammans med vilken av de fyra listorna som helst.
   När det är på:
   - Kartan ritar de fyra delarna som egna länder som går att öppna och ge status, med egna färger. Storbritannien som helhet går inte att trycka på.
   - I varje lista där GB ingår räknas de fyra delarna i stället för GB, så totalen ökar med tre (FN 196, FN och observatörer 198, med Taiwan och Kosovo 200, alla 240). Talen i landlista.* fylls i av {totalt} som förut.
   - Statistik, mål, märken, Vi (alla lägen), listan Platser, kartans fokusval och sök använder delarna i stället för GB.
   - Flaggor: England, Skottland och Wales har egna flaggor. Använd dem om appens flaggkälla har dem, annars Storbritanniens flagga. Nordirland visas med Storbritanniens flagga.
   När det är av är allt som i dag, och delarnas statusrader ligger kvar orörda i databasen men visas och räknas inte.

5. Befintliga markeringar. Har användaren en status på GB och valet är på: visa texten karta.delade.flytta ({plats} är landets namn) överst i rutan för var och en av de fyra delarna tills minst en del har fått en status, och föreslå samma status som GB hade som förval. Ta inte bort raden för GB: den används igen om valet slås av. Räkna aldrig både GB och en del.

6. Sådant som pekar på GB fortsätter fungera: resor med Storbritannien som plats, valutan, Innan avresa och lätta platser i Upptäck. I sök efter resmål visas både Storbritannien och de fyra delarna.

7. Enhetstester: totalerna för alla fyra listorna med valet på och av, att GB och delarna aldrig räknas samtidigt, förvalet för befintliga användare, förslaget från GB:s gamla status, valideringen. Röktestet: kontrollera att England går att öppna på kartan, markera Skottland som besökt och kontrollera att antalet länder i Vi ökar med ett, slå av valet och kontrollera att Storbritannien går att öppna igen, och städa efteråt.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 19: Storbritanniens fyra länder" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
