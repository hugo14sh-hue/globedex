# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '03 - Körning 3: listor'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning med ny del av appen.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'build, typecheck och test är gröna'
  'npm run dev: bocka av en punkt i Amsterdam och se att fyndet hamnar i samlingsboken'
  'Lägg till en punkt ur bucketkatalogen och bocka av den'
  'Kartan: växla mellan Min karta och Vår karta (kräver att ni är två i gruppen)'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, docs/schema.sql och delen Listor i docs/prototyp.html innan du gör något. Körning 1 och 2 är klara och innehållet är importerat.

DEL A - efter Körning 2:

1. SQL-blocket från din slutrapport i Körning 2 är kört i Supabase (behörigheter och formatkontroll på place_status.place_id). Dessutom är samma ändring gjord på fyra tabeller till: finds, collection_entries, reviews och trips har inte längre någon främmande nyckel mot places på place_id, utan en check med samma format (ISO-kod eller innehålls-id, null tillåtet). Uppdatera docs/schema.sql så att filen motsvarar databasen: GRANT-blocket sist, och de fem ändrade kolumnerna. Ändra inget annat i schemat.

2. Texterna du listade som saknade finns nu i content/_texter.json. Använd dem. Nya nycklar för punkt 3: karta.visa.min, karta.visa.var, karta.visa.medlem (med {namn}).

3. Kartan: bygg växlingen mellan kartor som i prototypen. I par och grupp går det att välja Min karta, Vår karta (ett land får den högsta statusen någon i gruppen har satt, i ordningen bor, har bott, besökt, planerad, vill åka, mellanlandat) och en enskild medlems karta. Bara den egna statusen går att ändra. I solo visas ingen växling. Kontrollera att RLS tillåter läsning av gruppmedlemmars status och inget annat, och skriv tester för sammanslagningen.

4. Platsnamn för länder utan innehåll: appen behöver svenska namn på alla länder för statuslistan och bottenarket. Använd Intl.DisplayNames med språket sv på ISO-koden. Skriv inga egna landsnamn.

DEL B - Körning 3:

Läs docs/korning-3.md och gör den. Tillägg:
- När en listpunkt med compendium_id bockas av skapas fyndet i samma steg (det som väntade från Körning 2). Tas avbockningen bort ligger fyndet kvar, men visa det inte dubbelt om punkten bockas av igen.
- Kategorietiketter: lista.kategori.*, bucket.kategori.*, kostnad.* och sallsynthet.* finns i _texter.json.
- Bucketkatalogen har 93 punkter i 8 kategorier. place_ids kan vara tom.

Regler: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block och förklarar varför, och nya tabeller eller funktioner får alltid med GRANT-rader. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md.

Avsluta med npm run build, npm run typecheck och npm test, gör en git commit med meddelandet "Körning 3: listor", och skriv en slutrapport med rubrikerna: Klart, Inte klart, Saknade textnycklar, Det här behöver Hugo göra.
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
