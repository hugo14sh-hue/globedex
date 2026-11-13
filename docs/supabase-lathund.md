# Supabase: lathund för Globedex

Kontrollerad mot Supabase dokumentation 2026-11-13. Menyerna kan ha bytt namn sedan dess. Hittar du inte något: sök på rubriken i Supabase egen sökruta.

## 1. Skapa projektet
1. Gå till supabase.com och logga in.
2. New project. Namn: globedex. Region: närmaste i Europa.
3. Välj ett databaslösenord och spara det i din lösenordshanterare. Det behövs inte i appen.
4. Vänta tills projektet är klart.

## 2. Kör schemat
1. Kör startpaketets PowerShell-block först, så att mappen C:\Users\Hugo\globedex finns.
2. Kopiera hela schemat till urklipp med det här blocket:

```powershell
Get-Content "C:\Users\Hugo\globedex\docs\schema.sql" -Raw | Set-Clipboard
```

3. I Supabase: SQL Editor, ny fråga, klistra in, Run.
4. Rätt resultat: inga fel, och under Table Editor finns 30 tabeller.
5. Kör schemat bara en gång. Får du fel halvvägs: klistra in felmeddelandet i chatten innan du kör något mer.

## 3. Hämta URL och nycklar
1. Settings, API Keys, fliken Publishable and secret API keys.
2. Finns knappen Create new API keys: tryck på den.
3. Du behöver tre värden:
   - Project URL (https://xxxx.supabase.co)
   - Publishable key (börjar med sb_publishable_)
   - Secret key (börjar med sb_secret_)
4. Använd inte de äldre nycklarna anon och service_role. Supabase fasar ut dem.

Öppna C:\Users\Hugo\globedex\.env.local och fyll i:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

Den hemliga nyckeln går förbi alla behörighetsregler. Den används bara av importskriptet på din dator. Klistra aldrig in den i chatten, i koden eller i Vercel.

## 4. Inloggning med e-post och lösenord
Appen loggar in med e-post och lösenord. Inga mejl skickas.

Authentication, Sign In / Providers, Email:
- Email ska vara påslaget.
- Confirm email ska vara avstängt. Annars får den som skapar ett konto inte någon session och kan inte logga in.
- Minimum password length: sätt 8, så att Supabase kräver samma som appen.

Authentication, URL Configuration:
- Site URL: http://localhost:5173. När appen ligger på Vercel (Körning 7): byt till Vercel-adressen.

Varje person skapar sitt eget konto i appen med Skapa konto. Glömt lösenord finns inte i fas 1, eftersom det kräver mejl. Glömmer någon lösenordet: säg till i Claude Code, så skrivs ett skript som sätter ett nytt lösenord med den hemliga nyckeln. Ta inte bort användaren i Supabase, då försvinner all data som hör till kontot.

## 5. E-post behövs inte nu
Eftersom Confirm email är avstängt behövs ingen egen e-postavsändare (custom SMTP). Den behövs först om glömt lösenord byggs i fas 2.

## 6. Klart när
- 30 tabeller finns i Table Editor.
- .env.local har tre ifyllda rader.
- Confirm email är avstängt och minsta lösenordslängd är 8.
- Skriv sedan i Claude Code: Läs docs/korning-1.md och gör den.
