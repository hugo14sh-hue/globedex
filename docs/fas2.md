# Fas 2: idéer som väntar

- Glömt lösenord: återställning via mejl. Kräver en egen e-postavsändare (custom SMTP) i Supabase och att Confirm email slås på igen.
- Kartan: färglägg Sveriges landskap (places med layer landskap) som egna ytor, inte bara länder. Kräver gränser per landskap.
- Kartan: spara kartplattor för offline-läsning (OpenFreeMap tillåter högst 3 000 plattor eller 50 MB per nedladdning).
- Samlingar: föreslå nya samlingar utifrån nycklarna i gift_tips.collection_motifs (som knapparna i prototypen).
- Swipe: ändra eller ta tillbaka en röst i vyn Lista.
- Samlingsbok: datum, plats och anteckning på ett fynd i efterhand (finds.note finns redan i databasen).
- Bucketlist och swipe: uppdatera direkt när någon annan i gruppen ändrar (Supabase Realtime).
- Resekassa: knappen Gör upp med Swish (som i prototypen) med beloppet ifyllt.
- Innan avresa: färdiga punkter per land (pass, visum, försäkring, roaming) ur content/, med källa. Kräver en innehållsfil.
- Inköpslista: koppla saker till presentmottagare (recipients) och matcha presenttips mot deras intressen.
- Resor: offline-läsning av resan, bokningar och bokningsfiler (Körning 7).
- Uppspelning: bågar för flygetapper i stället för raka linjer, och restid per etapp i uppspelningen.
- Idag: restid med bil från vald plats (en rutttjänst) i stället för avstånd fågelvägen. drive_minutes gäller bara från idéns egen plats.
- Idag: visa Nära på kartan, med vald plats och avståndsringar.
- Idag: namnet på platsen där man är (omvänd geokodning) i stället för "Där jag är nu".
- Idag: spara platser ur Nära, inte bara idéer.
- Idag: egen plats som inte finns i innehållet saknar koordinater. En sökning efter orten skulle ge Nära även där.
