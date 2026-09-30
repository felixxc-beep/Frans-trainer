# Supabase instellen voor Mon parcours

De trainer blijft zonder deze configuratie volledig lokaal werken. Fase 2 gebruikt alleen de publieke Project URL en de publishable key. Gebruik nooit een secret key of de oude `service_role`-key in de webapp.

## 1. Project aanmaken

1. Ga naar https://supabase.com en maak een account aan.
2. Kies **New project**.
3. Kies je organisatie, geef het project een naam en maak een sterk databasewachtwoord.
4. Kies een Europese regio die bij de school past.
5. Wacht tot het project volledig klaar is.

## 2. Database installeren

1. Open in het projectmenu **SQL Editor**.
2. Kies **New query**.
3. Open lokaal `supabase/schema.sql`, kopieer de volledige inhoud naar de editor en klik **Run**.
4. Maak daarna opnieuw een lege query.
5. Open `supabase/rls.sql`, kopieer de volledige inhoud en klik **Run**.
6. Controleer onder **Database → Tables** dat `classes`, `students`, `practice_sessions` en `practice_attempts` bestaan.
7. Controleer onder **Database → Policies** dat RLS op alle vier tabellen actief is.
8. Open **Settings → API → Exposed schemas** en controleer dat `private` daar NIET tussen staat. Het `private` schema mag nooit via de Data API worden blootgesteld.

Voer `schema.sql` altijd vóór `rls.sql` uit. Bewaar beide bestanden in Git; ze documenteren exact hoe de database is beveiligd.

## 3. Eerste leerkracht voor testdata maken

Fase 2 bevat nog geen leerkrachtendashboard, maar een Auth-gebruiker is al de eigenaar van een klas.

1. Open **Authentication → Users**.
2. Kies **Add user** en daarna **Create new user**.
3. Vul het school-e-mailadres van de leerkracht en een tijdelijk sterk wachtwoord in.
4. Zet de gebruiker voor deze test als bevestigd aan als Supabase die keuze toont.
5. Open de aangemaakte gebruiker en kopieer zijn UUID.

## 4. Testklas en leerlingen toevoegen

1. Open `supabase/seed.example.sql`.
2. Vervang `00000000-0000-0000-0000-000000000000` door de gekopieerde leerkracht-UUID.
3. Pas desgewenst klasnaam, klascode, leerlingcodes en weergavenamen aan. Leerlingcodes moeten 8–64 tekens lang zijn.
4. Kopieer de aangepaste SQL naar een nieuwe query in **SQL Editor** en klik **Run**.
5. Kijk onder **Database → Tables → classes** en **students** of de testregels bestaan.

Gebruik voor echte klassen willekeurige, niet eenvoudig te raden leerlingcodes van minimaal 8 tekens. Als later bij het toevoegen van een leerling geen code wordt meegegeven, genereert de database automatisch een willekeurige code van 16 tekens. Leerlingcodes zijn pseudonieme identificatiegeheimen, geen gewone volgnummers of wachtwoorden.

## 5. Publieke browserconfiguratie invullen

1. Open bovenaan het Supabase-project de **Connect**-dialoog.
2. Kopieer de **Project URL**.
3. Kopieer de **Publishable key** die begint met `sb_publishable_`.
4. Als de Connect-dialoog de sleutel niet toont, ga naar **Settings → API Keys**. Maak daar zo nodig eerst een publishable key.
5. Open lokaal `config.js` en vul alleen deze twee waarden in:

```js
window.MON_PARCOURS_CONFIG = Object.freeze({
  supabaseUrl: "https://jouw-project.supabase.co",
  supabasePublishableKey: "sb_publishable_..."
});
```

Een publishable key mag in browsercode staan: de echte beveiliging zit in grants, RLS en de begrensde databasefuncties. Kopieer nooit een `sb_secret_...`, secret key of `service_role`-key naar `config.js`.

## 6. Leerlingkoppeling testen

1. Start de website lokaal via een webserver of open de GitHub Pages-site.
2. Klik bovenaan op **Lokaal**.
3. Vul de klascode en leerlingcode uit de testdata in.
4. Na een geldige combinatie toont de knop de leerlingnaam.
5. Start een korte oefensessie en beantwoord enkele vragen.
6. Controleer in Supabase onder **Table Editor** dat één `practice_sessions`-regel en de bijbehorende `practice_attempts` zijn toegevoegd.
7. Vernieuw de pagina of klik opnieuw op synchroniseren door weer online te gaan: dezelfde `client_session_id` en `client_attempt_id` mogen geen dubbele regels opleveren.

## 7. Offline gedrag testen

1. Koppel eerst een leerling terwijl internet werkt.
2. Zet in de browserontwikkelaarstools **Network → Offline** aan.
3. Maak een oefensessie. De trainer moet normaal blijven werken.
4. In localStorage staat de nog te verzenden data onder `monParcoursSyncQueueV1`.
5. Zet **Offline** weer uit. De browser probeert de outbox automatisch opnieuw te verzenden.
6. Controleer dat de outbox na succes leeg is en de database geen dubbele pogingen bevat.

## 8. GitHub Pages bijwerken

1. Commit en push `index.html`, de JavaScriptbestanden, `styles.css`, `data/course.json`, `config.js`, `supabase/` en de tests naar dezelfde branch als de Pages-site.
2. Open **GitHub → Settings → Pages** en controleer dat nog steeds **Deploy from a branch** en `/(root)` gekozen zijn.
3. Wacht op de groene Pages-deployment en test de publieke URL.

Er is geen Node-server of buildstap nodig. Supabase wordt rechtstreeks via beveiligde HTTPS-RPC-calls gebruikt.

## Beveiligingscontrole

- `anon` krijgt geen SELECT-, INSERT-, UPDATE- of DELETE-recht op leerlingtabellen.
- Alleen `verify_student_identity` en `ingest_practice_bundle` zijn voor de publieke client uitvoerbaar.
- Deze publieke functies zijn dunne `SECURITY INVOKER`-wrappers. De bevoorrechte `SECURITY DEFINER`-logica staat in het niet-blootgestelde `private` schema met `search_path = ''`.
- Een leerlingtoken kan resultaten insturen, maar geen resultaten uitlezen.
- Getypte antwoorden worden alleen lokaal verwerkt en nooit in `practice_attempts` opgeslagen.
- Ingelogde leerkrachten kunnen via RLS alleen klassen, leerlingen en resultaten zien waarvan `classes.owner_id` hun eigen Auth-UUID is.
- Fase 2 maakt nog geen `teacher.html`; die interface hoort bij fase 3.
