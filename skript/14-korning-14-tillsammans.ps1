# Globedex - promptskript for Claude Code. UTF-8 MED BOM, CRLF.
# Ett skript per prompt. Kor:
#   powershell -ExecutionPolicy Bypass -File "C:\Users\Hugo\globedex\skript\<NN-namn>.ps1"

# ===================== INSTÄLLNINGAR =====================
$steg     = '14 - Körning 14: på egen hand eller tillsammans'
$session  = 'NY'                 # 'NY' eller 'SAMMA'
$varfor   = 'Ny körning. Körning 13 är avslutad och incheckad.'
$kravEnv  = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY')                    # rader som måste vara ifyllda i .env.local
$kontroll = @(
  'FÖRE: SQL-blocket från chatten ska vara kört i Supabase'
  'EFTER: npm run import, så att de nya texterna hamnar i databasen'
  'Öppna ett besökt land: raden Vem var med? ska finnas'
  'Välj Tillsammans: landet byter färg på Min karta och Vår karta'
  'Vi: läget Tillsammans visar bara det ni markerat tillsammans'
  'git push så att Vercel bygger om'
)
# ===================== PROMPT ============================
$prompt = @'
Läs CLAUDE.md, FORMAT.md för innehållet och docs/schema.sql innan du gör något. Körning 1 till 13 är klara.

Körning 14: på egen hand eller tillsammans

Textfilerna i content/ har 33 nya nycklar (624 per språk) och en ny platshållare, {grupp}. Ändra inte i innehållsfilerna: stämmer något inte, skriv det i slutrapporten.

Databasen: Hugo har redan kört SQL-blocket nedan i Supabase. Lägg in samma block i docs/schema.sql på rätt ställe, och gör inga andra databasändringar.

   alter table public.place_status
     add column if not exists together_group uuid references public.groups(id) on delete set null;
   comment on column public.place_status.together_group is
     'Gruppen man besökte platsen tillsammans med. Tomt betyder på egen hand.';
   drop policy if exists "together_member" on public.place_status;
   create policy "together_member" on public.place_status as restrictive for all to authenticated
     using (true)
     with check (together_group is null or public.is_member(together_group));
   create index if not exists place_status_together_idx
     on public.place_status (together_group) where together_group is not null;

Betydelsen: together_group är tomt när platsen besöktes på egen hand, och gruppens id när den besöktes tillsammans med gruppen. Var och en skriver bara sina egna rader (RLS). Har minst en medlem i gruppen en rad med together_group lika med gruppens id räknas platsen som besökt tillsammans för hela gruppen, i alla gruppvyer. Den andra behöver alltså inte markera samma sak.

1. Statusvalet för en plats (länder, städer, regioner). När statusen är besokt, bor, bott eller mellan och användaren är med i en grupp av typen par eller grupp visas en ny rad under statusvalet: rubriken karta.sallskap.rubrik och ett val mellan karta.sallskap.jag och karta.sallskap.tillsammans ({grupp} är gruppens namn; är användaren med i flera grupper visas ett alternativ per grupp). Under valet står karta.sallskap.hjalp. Förvalt är karta.sallskap.jag. Valet sparas i together_group. Bekräftelsen efter sparat val: karta.sallskap.sparat när en grupp är vald, annars som i dag. För status vill och planerad visas inte raden, och together_group sätts till tomt.

2. Min karta och Vår karta ska skilja sig åt. Växlingen heter karta.vy.min och karta.vy.var (karta.vy.aria). Finns den redan under andra nycklar: behåll de gamla nycklarna och lista de nya som oanvända i slutrapporten.
   Min karta visar bara mina egna rader. Besökta platser får två färger: på egen hand (karta.forklaring.sjalv) och tillsammans (karta.forklaring.tillsammans).
   Vår karta visar gruppens besökta platser i fyra färger, i den här ordningen när flera stämmer:
   a. tillsammans: minst en medlem har together_group lika med gruppen (karta.forklaring.tillsammans)
   b. båda, var för sig: alla medlemmar har besökt platsen men ingen har markerat tillsammans (karta.forklaring.bada)
   c. bara jag (karta.forklaring.bara-jag)
   d. bara den andra (karta.forklaring.bara-annan, {namn} är den andras visningsnamn; i en grupp med fler än två: en gemensam färg och namnen i platsens ruta)
   Färger, ljust tema: tillsammans #E0527A, båda var för sig #7B61C9, bara jag: den färg besökt har i dag, bara den andra #E0A030. Ta fram motsvarande för mörkt tema med samma kulörer, och kontrollera att de fyra går att skilja åt mot kartans bakgrund och mot färgerna för vill åka och planerad. Lägg dem som tokens bredvid de befintliga statusfärgerna.
   En förklaring med rubriken karta.forklaring.rubrik visar de färger som den valda kartan använder. Vill åka och planerad visas som i dag i båda kartorna.
   Är användaren inte med i någon par- eller gruppgrupp visas inte växlingen, och Min karta ser ut som i dag.

3. Fliken Vi, siffrorna. Överst ett val (vi.vy.aria) med vi.vy.tillsammans, vi.vy.nagon, vi.vy.jag och vi.vy.annan ({namn} är den andras visningsnamn). Förvalt är vi.vy.tillsammans. Under valet står vi.vy.hjalp.tillsammans eller vi.vy.hjalp.nagon när de lägena är valda.
   Tillsammans: bara platser som är besökta tillsammans enligt regeln ovan, och bara gruppens resor. Någon av oss: som siffrorna räknas i dag. Jag och den andra: bara den personens rader.
   Är läget Tillsammans tomt visas vi.siffror.tom.tillsammans i stället för vi.siffror.tom.
   Gäller länder, kontinenter, landskap och delstater. Fynd och bucketlistan räknas som i dag i alla lägen: skriv i slutrapporten om det behövs en regel för dem.

4. Resor. När en resa skapas ska man välja vem som reser: rubriken resa.vem.rubrik, alternativen resa.vem.solo (användarens sologrupp) och resa.vem.grupp för varje par- eller gruppgrupp ({grupp} är gruppens namn). Under valet resa.vem.hjalp när solo är valt. Förvalt är den grupp som är vald i appen i dag. Valet styr trips.group_id, ingen databasändring behövs.
   I listan över resor: ett filter (resa.filter.aria) med resa.filter.alla, resa.filter.solo och resa.filter.grupp per grupp. Filtret visas bara när användaren har resor i mer än en grupp eller är med i en par- eller gruppgrupp. Soloresor får märket resa.marke.solo på kortet.
   Kontrollera hur gruppen väljs för en ny resa i dag och skriv det i slutrapporten, så att jag vet vad som ändrades.

5. Vilka länder räknas, på kartan. Inställningen under Anpassning finns kvar som den är. Lägg en liten knapp på kartan, intill lägesväljaren, med texten karta.landlista.knapp ({antal} är antalet länder i den valda listan) och aria-label karta.landlista.aria. Den öppnar samma val som under Anpassning. Länder utanför den valda listan ritas med ett diagonalt streckmönster ovanpå sin vanliga färg på kartan, och går fortfarande att öppna och markera. Texten landlista.utanfor visas redan i platsens ruta.

6. Enhetstester: regeln för tillsammans (en medlem räcker), ordningen a till d på Vår karta, Min karta med och utan together_group, de fyra lägena i Vi, together_group nollställs för vill och planerad, filtret för resor. Röktestet: markera ett land som besökt, välj Tillsammans, kontrollera färgen på Min karta och Vår karta och att landet räknas i Vi i läget Tillsammans. Testkontot har ingen partner: skapa det som behövs i testets egen data och städa efteråt.

Regler: Skriv inga egna texter och översätt ingenting själv. Saknas en text på något av språken: lista nyckeln i slutrapporten. Gör inga databasändringar själv: behövs en till, ge mig ett SQL-block. Lägg inte till funktioner utöver punkterna: idéer skrivs i docs/fas2.md. Kör inte importen mot databasen. Vänta inte på bakgrundsjobb.

Avsluta med npm run import:check, npm run build, npm run typecheck, npm test och npm run test:e2e, kontrollera exitkoderna, gör en git commit med meddelandet "Körning 14: på egen hand eller tillsammans" och skriv slutrapporten innan du avslutar, med rubrikerna Klart, Inte klart, Röktestet, Saknade textnycklar per språk, Det här behöver Hugo göra.
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
