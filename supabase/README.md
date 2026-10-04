# Supabase instellen voor Mon parcours

De statische site blijft zonder buildstap laden, maar een nieuwe leerling moet eenmaal online via Supabase met schoolmail worden geïdentificeerd voordat oefenen mogelijk is. Een eerder gekoppelde leerling kan offline verder. De frontend gebruikt alleen de publieke Project URL en publishable key. Gebruik nooit een secret key of de oude `service_role`-key in de webapp.

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
3. Vul de schoolmail van een actieve testleerling in. De klas- en leerlingcode blijven alleen beschikbaar als technische hersteloptie.
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
- Leerling-RPC’s blijven afzonderlijk begrensd; teacherbeheer gebruikt alleen authenticated toegang en de gecontroleerde admin-RPC.
- Deze publieke functies zijn dunne `SECURITY INVOKER`-wrappers. De bevoorrechte `SECURITY DEFINER`-logica staat in het niet-blootgestelde `private` schema met `search_path = ''`.
- Een leerlingtoken kan resultaten insturen, maar geen resultaten uitlezen.
- Getypte antwoorden worden alleen lokaal verwerkt en nooit in `practice_attempts` opgeslagen.
- Ingelogde leerkrachten kunnen via RLS alleen klassen, leerlingen en resultaten zien waarvan `classes.owner_id` hun eigen Auth-UUID is.
- Het leerkrachtendashboard gebruikt voor beheer uitsluitend de bestaande `authenticated` grants en RLS-policies; resultaat-tabellen blijven read-only.

## Fase 4: eenmalige klascode-migratie

Voer na een back-up **handmatig** `phase4-management.sql` uit in de Supabase SQL Editor. Dit brengt de databasecontrole voor klascodes in lijn met de beheerinterface: 2–20 letters, cijfers of streepjes. Het script controleert eerst bestaande klascodes en stopt zonder wijziging wanneer een bestaande code niet aan de nieuwe regel voldoet.

Deze migratie verandert geen grants, RLS-policies, leerling-RPC's, sessies of pogingen. De globale uniciteit van `class_code` blijft behouden, zodat leerlingkoppeling zonder extra school- of leerkrachtidentifier ondubbelzinnig blijft.

## Fase 5A: schoolmailidentificatie

Voer **handmatig** `phase5-school-email.sql` uit voordat je de fase-5A-frontend publiceert. Het script:

- voegt nullable `school_email` en de gegenereerde lowercase-vergelijkingskolom toe;
- accepteert uitsluitend `@camposturnhout.be`;
- bewaakt globale uniciteit van de genormaliseerde schoolmail;
- geeft authenticated leerkrachten via de bestaande RLS-policies toegang tot deze ene beheerkolom;
- maakt de minimale publieke RPC `verify_student_email(text)` met private `SECURITY DEFINER`-implementatie;
- wijzigt geen leerlingcodes, sync-tokens, leerling-ID's of historische resultaten.

Deze login is eenvoudige identificatie, geen geverifieerde e-mailauthenticatie. Gebruik ze alleen voor dezelfde oefen- en syncmogelijkheden als de bestaande leerlingcode-login.

## Fase 5B: actieve oefentijd

Voer na `phase5-school-email.sql` **handmatig** `phase5-active-time.sql` uit voordat je de fase-5B-frontend en het bijgewerkte dashboard publiceert. Het script:

- voegt de nullable/backward-compatible kolom `practice_sessions.active_duration_seconds` toe;
- bewaart nieuwe sessietijd als een geheel aantal seconden;
- vervangt de ingestfunctie zodat snapshots met dezelfde `client_session_id` de hoogste totale tijd bewaren en retries nooit tijd optellen;
- laat oude sessies zonder gemeten tijd op `NULL`, zodat het dashboard daarvoor `—` toont;
- verfijnt de schoolmail-RPC met afzonderlijke resultaten voor onbekende en inactieve leerlingen;
- verandert geen leerling-ID's, sync-tokens, pogingen, RLS-policies of cursusdata.

Publiceer de nieuwe frontend pas na deze migratie: de nieuwe dashboardquery verwacht dat de kolom bestaat.

## Fase 5: beheersingsmodel

Voer na de eerdere fase-5-migraties **handmatig** `phase5-mastery.sql` uit voordat je de mastery-frontend publiceert. Het script:

- maakt geen nieuwe tabel en slaat geen permanente statusvlag op;
- leidt beheersing telkens af uit de bestaande, idempotente sessies en pogingen;
- geeft een leerling via `get_student_mastery` uitsluitend eigen aggregaten per `item_id` en `item_variant`;
- geeft geen prompts, modelantwoorden of getypte antwoorden terug;
- gebruikt een publieke `SECURITY INVOKER`-wrapper en private `SECURITY DEFINER`-logica met `search_path = ''`;
- laat alle directe rechten op `practice_attempts` ongewijzigd.

Live procedure:

1. Open Supabase → **SQL Editor** → **New query**.
2. Kopieer de volledige inhoud van `supabase/phase5-mastery.sql` en klik **Run**.
3. Controleer onder **Database → Functions** dat `public.get_student_mastery` en `private.get_student_mastery_impl` bestaan.
4. Publiceer daarna `mastery.js`, de bijgewerkte HTML/CSS/JavaScriptbestanden en de overige repositorybestanden naar GitHub Pages.
5. Meld een testleerling aan, maak zelfstandige pogingen in minstens twee sessies en vernieuw de pagina.
6. Controleer dat de voortgang behouden blijft, dat offline gemaakte pogingen onmiddellijk meetellen en dat `monParcoursSyncQueueV1` na herverbinden leegloopt zonder dubbele databasepogingen.

## Fase 6: meerdere leerkrachten en klastoegang

Voer **handmatig** `phase6-multi-teacher.sql` uit na alle eerdere migraties en vóór publicatie van het nieuwe dashboard. De migratie maakt `teachers` en `class_teachers`, activeert RLS, vervangt de oude `classes.owner_id`-policies door many-to-many klastoegang en voegt de admin-RPC voor leerkrachtentoegang toe. Leerlingidentificatie, ingest, mastery en historische resultaten worden niet gewijzigd.

Bootstrap:

- Is er exact één bestaande Auth-user en zijn er nog geen teacherprofielen, dan wordt die gebruiker automatisch actieve admin.
- Zijn er meerdere bestaande Auth-users, dan raadt de migratie niemand als admin. Voer dan in de SQL Editor onderstaande instructie uit met het juiste e-mailadres:

```sql
update public.teachers t
set role = 'admin', is_active = true
from auth.users u
where t.auth_user_id = u.id
  and lower(u.email) = lower('VUL-HIER-HET-ADMIN-EMAILADRES-IN');
```

Nieuwe collega toevoegen:

1. Open Supabase → **Authentication → Users** en nodig de collega uit of maak het Auth-account aan.
2. De database-trigger maakt automatisch een profiel met `role = teacher` en `is_active = false`.
3. Meld aan als admin en open **Leerkrachten**.
4. Controleer de naam, activeer het account en vink één of meerdere klassen aan.
5. De collega kan daarna met het eigen Auth-account inloggen en ziet uitsluitend die klassen.

De frontend bevat geen Admin API, service-role-key of uitnodigingsfunctionaliteit. Het intrekken van toegang gebeurt door het teacherprofiel inactief te zetten; historische data en klastoewijzingen blijven bestaan. De laatste actieve admin kan server-side niet worden gedeactiveerd, verwijderd of naar teacher worden teruggezet.

## Fase 7: taken op basis van beheersing

Voer **handmatig en éénmalig** `supabase/phase7-assignments.sql` uit in de Supabase SQL Editor, ná `phase6-multi-teacher.sql` en vóór publicatie van de fase-7-frontend. Het script is een migratie en is niet bedoeld om twee keer uit te voeren. Maak vooraf een databaseback-up. De migratie maakt `assignments`, `assignment_classes`, `assignment_items`, `assignment_completions` en een register van de huidige 1.036 permanente item-ID's. Ze voegt een nullable `assignment_id` aan `practice_sessions` toe en vervangt de **private** `ingest_practice_bundle_impl`; de publieke ingest-RPC behoudt zijn signatuur.

Daarna kun je optioneel `supabase/phase7-verification.sql` uitvoeren: dit is alleen-lezen en controleert ID-aantal, RLS, tabelrechten en RPC-rechten. De migratie zelf is hier niet automatisch op jouw project uitgevoerd.

Taken gebruiken uitsluitend vaste item-ID's en geen gekopieerde cursusinhoud. Bij nieuwe Trajets moet het ID-register uitsluitend worden **aangevuld** met nieuwe permanente ID's; bestaande ID's blijven staan. Een taak kan meerdere klassen hebben. De huidige mastery wordt uit alle pogingen op die items berekend, ook buiten de taak; eerste voltooiing wordt server-side éénmaal in `assignment_completions` vastgelegd. Task-gestarte sessies dragen `assignment_id` en leveren actieve taaktijd. De bestaande offline queue synchroniseert ze idempotent.

Een gearchiveerde taak wordt niet meer aan leerlingen uitgedeeld. Om reeds lokaal gestarte/offline sessies niet kwijt te raken, accepteert ingest nog geldige task-sessies van een eerder gepubliceerde, inmiddels gearchiveerde taak. Alleen task-gelinkte pogingen kunnen dan nog een historische completion vastleggen; gewone oefenpogingen activeren na archivering geen nieuwe completion.

Nieuwe publieke RPC's zijn `get_student_assignments(text)` (alleen na verificatie van het eigen sync-token), `get_teacher_assignments()`, `get_teacher_assignment_detail(uuid)` en `save_assignment(jsonb)`. Privileged functies blijven in `private`, met `search_path = ''`. Er is geen publieke tabel-SELECT voor leerlingen of frontend-service-role. Actieve admins beheren alle taken; actieve leerkrachten maken taken alleen voor klassen met toegang. Alleen de maker of een admin kan wijzigen of archiveren; co-teachers met klastoegang kunnen details lezen, uitsluitend voor hun toegestane leerlingen. Bij een gepubliceerde taak met activiteit blokkeert de server een wijziging van klassen of items. Archiveren verwijdert geen historische resultaten.

Publiceer na de SQL-migratie `index.html`, `teacher.html`, `app.js`, `teacher.js`, `assignments.js`, beide CSS-bestanden en de overige repositorybestanden naar GitHub Pages. Test met een concept (onzichtbaar voor leerlingen), een gepubliceerde taak voor twee klassen, een offline leerling, een co-teacher en een teacher zonder toegang tot een van die klassen. De taakdefinitie is op de leerlingbrowser per identiteit gecachet; nieuw gepubliceerde taken vereisen eerst internet. De eerste definitieve voltooiing verschijnt pas na synchronisatie.
## Fase 7b — werkwoordbeheersing

Voer `phase7b-verb-mastery.sql` **handmatig en één keer** uit in Supabase SQL Editor, na `phase7-assignments.sql`. Het script wordt niet door de frontend uitgevoerd. Maak vooraf een databaseback-up. Voer daarna optioneel het alleen-lezen `phase7b-verification.sql` uit: verwacht 55 werkwoord-ID's, 39 reguliere en 16 onregelmatige items, drie regeldoelen, RLS aan en geen directe leerling-SELECT. Het voegt alleen classificatie en taakvereisten toe; bestaande course-ID's, sessies, pogingen en taken blijven bestaan. Taken zonder `mastery_strategy` blijven `item_mastery`.

De vaste classificatie staat ook in `verb-mastery.js`: 22 expliciet als `verbes en -ER` aangeduide items vormen één regeldoel `present_er`; `type finir` en `verbes en -RE` zijn andere regeldoelen; de expliciet afwijkende werkwoorden worden per permanent item-ID gevolgd. Classificatie gebeurt **niet** op basis van de infinitiefuitgang. `aller` is bijvoorbeeld onregelmatig.

Zes canonieke persoonsgroepen: `je/j’`, `tu`, `il/elle/on`, `nous`, `vous`, `ils/elles`. Een regel wordt `Acquis` bij zes correct toegepaste persoonsgroepen, drie verschillende werkwoorden, acht correcte zelfstandige vervoegingen, minstens 75% accuracy **op vervoegingen**, twee sessies met vervoegingen en een laatste juiste zelfstandige **vervoeging**. Voor een onregelmatig werkwoord gelden dezelfde eisen zonder de drie-werkwoordenvoorwaarde. `Apprendre` levert geen zelfstandig bewijs. Regelherkenning draagt bij aan de continue score en oefenactiviteit, maar kan zwakke of laatst foutieve vervoegingen niet maskeren.

De continue score voor een regel is `30% accuracy-evidence + 40% persoonsdekking + 20% werkwoorddiversiteit + 10% sessiespreiding`. Accuracy-evidence is `correct / max(8, pogingen)` (vervoegingen én regelherkenning), persoonsdekking `correct toegepaste groepen / 6`, diversiteit `correct toegepaste werkwoorden / 3` (maximaal 1), spreiding `bewijs-sessies / 2` (maximaal 1). Voor een onregelmatig werkwoord zijn de gewichten 40%, 50% en 10% zonder diversiteit. Alleen `Acquis` toont 100%; anders maximaal 99%. SQL en JavaScript gebruiken dezelfde definities. Oude pogingen met een betrouwbaar `item_variant` en `exercise_key` tellen mee; onduidelijke legacy-tellers worden niet als regelbewijs verzonnen.

`get_student_verb_evidence` geeft uitsluitend pogingsmetadata van de leerling met een geldige identiteitstoken terug (geen getypte antwoorden). De student bewaart eigen pogingsmetadata ook lokaal zodat offline oefening en latere synchronisatie blijven werken. Lokale oude records zonder betrouwbaar `identity_subject` worden niet aan een leerling toegeschreven. Er is geen publieke tabel-SELECT of service-role-sleutel in de browser.

## Fase 8 — live klasmonitor

Voer `phase8-class-monitor.sql` **handmatig één keer** uit in de Supabase SQL Editor, na `phase7b-verb-mastery.sql` en vóór publicatie van de fase-8-frontend. Maak eerst een databaseback-up. Voer daarna desgewenst het alleen-lezen `phase8-verification.sql` uit. De migratie voegt twee begrensde teacher-RPC's en één index toe; ze maakt geen duplicerende tabel en wijzigt geen leerlingdata, opdrachten of beheersingsdrempels. Interne `SECURITY DEFINER`-functies staan in `private` met `search_path = ''`; publiek blootgestelde functies zijn `SECURITY INVOKER` en alleen voor `authenticated` uitvoerbaar. De server controleert actieve leerkrachtstatus en klastoegang, ook wanneer iemand handmatig een andere klas-ID aan de RPC doorgeeft.

De dashboard-start laadt via RLS uitsluitend klas- en leerlingbasisgegevens. De live monitor haalt alleen aggregaten uit `get_class_activity_monitor` op; elke 30 seconden voor korte perioden, zonder volledige pogingshistorie te downloaden. Detailanalyse wordt pas op verzoek geladen. Huidige item-mastery wordt bij openen van een klas en daarna hoogstens ongeveer elke vijf minuten herberekend met dezelfde itemformule als `mastery.js`; werkwoorddoelen komen op aanvraag uit de bestaande fase-7b-helper. `Bezig` vereist een nog open sessie én activiteit binnen 180 seconden. `Mogelijk vastgelopen` vereist minstens vijf zelfstandige pogingen en minder dan 40% juistheid in de gekozen periode.

**Beperking van bestaande data:** `active_duration_seconds` bewaart een sessietotaal, geen tijdlijn. De monitor schrijft deze seconden toe aan de periode waarin de sessie begon. Een sessie die over een periodegrens loopt kan zonder extra historische tijdmetingen niet exact worden opgesplitst. Dit wordt in het dashboard en CSV-label vermeld; er wordt geen verstreken kloktijd als actieve tijd verzonnen.
