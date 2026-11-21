# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '22 - Körning 22: personliga siffror och märken'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 21 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'Vi, läget Jag: dina egna siffror och märken, plus platserna ni markerat som tillsammans'
  'Vi, läget Emilia: hennes fynd, avbockat och märken, inte dina'
  'Vi, lägena Tillsammans och Någon av oss: inga märken, bara raden om att välja person'
  'Logga in som Emilia: hennes märken är låsta utom dem hon själv har nått'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 21 är klara.

Körning 22: personliga siffror och märken

Textfilerna har fem nya nycklar (742 per språk): vi.vy.hjalp.jag, vi.vy.hjalp.annan, vi.marken.for, vi.tidslinje.for och vi.marken.valj. Ändra inte i innehållsfilerna. Inga databasändringar behövs: finds och item_checks kan redan läsas av gruppens medlemmar (policyn group_read, rader som inte är privata).

Felet i dag (src/features/vi/Siffror.tsx och useViData.ts): väljaren Tillsammans, Någon av oss, Jag och den andras namn styr bara länder, kontinenter, landskap och delstater. Fynd, avbockat, märken och tidslinjen räknas alltid på den som är inloggad. Väljer Hugo Emilias namn ser han därför sina egna märken under hennes namn. Dessutom räknas inte platser som en medlem har markerat som tillsammans in i den andra medlemmens egna siffror och märken.

Principen: siffror, märken och tidslinje hör till en person. Det som en person har är sina egna rader plus det gruppen har markerat som tillsammans. Det som ligger i gruppen (resor, bucketlistan, sparade idéer, resekassan, packlistorna) är gemensamt och räknas för alla medlemmar som i dag.

1. En persons platser: personens egna rader i place_status, plus andra medlemmars rader där together_group är den aktiva gruppens id och statusen är en av dem som kan vara tillsammans (TOGETHER_STATUSES). En sådan rad räknas för personen med samma status. Har personen en egen rad för samma plats gäller den högsta statusen (higher). Lägg det som en ren funktion i src/lib/togetherLogic.ts och använd den i läget Jag, i läget för en annan medlem och för märkena. Lägena Tillsammans och Någon av oss räknar som i dag.

2. Läget för en annan medlem: hämta den medlemmens finds och item_checks (rader som inte är privata släpps igenom av RLS) och räkna siffran för fynd, avbockade platser, märken och tidslinje på den medlemmen. Recensioner räknas på den som skrev dem (created_by). Samlingar och Valvet kan inte läsas av andra: märken som bygger på dem visas inte alls när man tittar på en annan medlem.

3. Läget Jag: som i dag, med platserna enligt punkt 1. Märkena räknas på samma underlag som siffrorna i läget Jag.

4. Lägena Tillsammans och Någon av oss: siffrorna för länder, kontinenter, landskap och delstater visas som i dag. Rutorna för fynd visar summan för läget: Någon av oss är fynd som minst en medlem har, Tillsammans är fynd som alla medlemmar har. Märken och tidslinje visas inte i de två lägena. Visa i stället texten vi.marken.valj.

5. Rubriker och hjälptext: i läget för en annan medlem är rubrikerna vi.marken.for och vi.tidslinje.for med medlemmens namn. I läget Jag är rubrikerna som i dag. Hjälptexten under väljaren visas nu i alla fyra lägen: vi.vy.hjalp.jag i läget Jag och vi.vy.hjalp.annan med namnet i läget för en annan medlem.

6. Toasten för nytt märke (useNewBadgeToast) och konfettin gäller bara den inloggades egna märken och bara i läget Jag. Den får aldrig visas för en annan medlems märken.

7. Förvalt läge när fliken öppnas: Jag, inte Tillsammans. Valet ligger kvar under sessionen som i dag.

8. Wrapped och Exportera till Claude räknar på den inloggade enligt punkt 1 och 3.

9. Sololäget ändras inte.

10. Enhetstester: en persons platser (egen rad, en annans rad med tillsammans, en annans rad utan tillsammans räknas inte, högsta status vinner, vill åka och planerad följer aldrig med), märken för en annan medlem räknas på den medlemmens fynd, märken för samlingar och Valvet saknas i läget för en annan medlem, inga märken i Tillsammans och Någon av oss, toasten bara i läget Jag. Röktestet: öppna Vi, kontrollera att läget Jag är förvalt och att märkena visas, byt till Tillsammans och kontrollera att texten vi.marken.valj visas i stället för märkena.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 22: personliga siffror och märken" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.

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
