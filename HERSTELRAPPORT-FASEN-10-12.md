# Herstelrapport Mon parcours — 12 oktober 2026

## Afronding vanaf de bestaande werkmap — 12 oktober 2026

De huidige bestanden zijn behouden en gecontroleerd; eerdere fases zijn niet
opnieuw uitgevoerd. Er is geen Git-repository of oorspronkelijke codekopie in
deze werkmap. Een exacte diff tegenover de oorspronkelijke code kan daarom niet
worden vastgesteld. De aanwezige herstelcode, historische SQL-definities, tests
en vorige testlogs zijn als uitgangspunt gebruikt.

De oude `tmp/final-test-results.json` vermeldt twee falende tests en is dus geen
bewijs van een volledig geslaagde laatste controle. Bij de nieuwe uitvoering op
de huidige bestanden slagen **34/34 tests**. De actuele resultaten staan in
`tmp/resume-test-results.json`, met afzonderlijke `tmp/resume-*.log`-bestanden.
Alle JavaScriptbestanden in de root, scripts en tests hebben ook de Node-
syntaxcontrole doorstaan; zie `tmp/resume-syntax-results.json`.

De state-aware regressie heeft de generator uitgevoerd en bevestigd dat de
zelfstandige herstelmigration exact reproduceerbaar is. Migratie en verification
SQL behoefden na deze controle geen inhoudelijke wijziging. De bestaande
transactiecontrole vergelijkt aantallen en hashes van oorspronkelijke kolommen
vóór commit; nieuwe kolommen tellen niet als wijziging van historische waarden.
Een afwijking veroorzaakt rollback. De frontendregressie bevestigt behoud van
9/42 en 35/42 voortgang en de permanente itemselectie. De syncregressie bevestigt
behoud van lokale voortgang en wachtrij wanneer serverondersteuning ontbreekt.
Dit zijn lokale en statische controles, geen bewijs van behoud op productie.

Er zijn geen installaties, netwerk-/TLS-onderzoeken, PostgreSQL-runtime-tests,
productiequeries of publicaties uitgevoerd tijdens deze afronding. PostgreSQL-
uitvoering blijft een expliciete validatiebeperking. De onderstaande handmatige
uitvoervolgorde blijft van toepassing; historische fases niet opnieuw uitvoeren.

Bij verification moeten ook `not_null_constraint_drift` en
`rpc_grant_deviations` lege arrays zijn. Controleer voor iedere bestaande tabel
`row_counts`: geen `missing` en `count_not_lower = true`. Hogere aantallen door
nieuwe leerlingactiviteit zijn toegestaan; het historische behoudsbewijs geldt
op het commitmoment van de migration en bewijst geen onveranderde live data later.

De master spec en handoff zijn volledig gelezen. De werkmap, alle migratiefiles,
frontend, RPC-keten, masterylogica, offline queue en regressies zijn onderzocht.
Deze werkmap bevat geen `.git`; een git status of commit was daardoor niet mogelijk.
Er is geen productie-SQL uitgevoerd en niets gepubliceerd.

## Exacte uitvoervolgorde

1. Voer de volledige inhoud van **`supabase/phase10-12-state-aware-upgrade.sql`** uit
   in de Supabase SQL Editor.
2. Voer daarna uitsluitend **`supabase/phase10-12-state-aware-verification.sql`** uit.
3. Publiceer vervolgens de gewijzigde frontendbestanden als één samenhangende
   release. De cacheversie is `20261012-1`. Publiceren is hier niet uitgevoerd.

Voer de oorspronkelijke fase-10/11/12-migraties voor dit herstel **niet opnieuw** uit.
Bij een fout rolt de hersteltransactie terug. Een lock-timeout vraagt een nieuwe
uitvoering van hetzelfde volledige herstelbestand; niet een selectie van losse regels.

**Validatiegrens:** de SQL is statisch gecontroleerd en heeft ingebouwde
catalog-, integriteits- en databehoudcontroles. Zij is hier niet op PostgreSQL
uitgevoerd. Er is geen lokale PostgreSQL-installatie; de bedrijfsfirewall blokkeert
de installatie van PGlite. De afzonderlijke in-memory PostgreSQL-test staat klaar
in `scripts/test-state-aware-postgres.js`, maar is dus geen geslaagde uitvoertest.
De SQL-uitvoering is daarom nog geen bevestigde productievalidatie.

## Gevraagde bevindingen

1. **Afgeleide productie-state.** Uit de door jou gemelde fouten volgt dat
   `completion_kind` en minstens de lifecyclefunctie aanwezig zijn, terwijl
   `include_integrative_sentences` en `practice_question_submissions` ontbreken.
   De overige aanwezige objecten, hun definities en grants zijn zonder een
   productiecatalogus niet vast te stellen. Het herstel inventariseert de werkelijke
   beginstate in `private.mon_parcours_upgrade_runs` voordat het functies wijzigt.

2. **Fase-10-fout.** Het oorspronkelijke bestand gebruikt `ADD COLUMN` zonder
   bestaande kolom te herkennen. De herstelmigration gebruikt `IF NOT EXISTS` en
   controleert vervolgens het kolomtype. Een bestaande kolom bewijst niet dat alle
   rapportfuncties en wrappers aanwezig zijn.

3. **Fase-11-fout.** Het lifecyclebestand gebruikt eenmalige `CREATE FUNCTION` en
   functierenames. Een bestaande grace-functie laat die herhaling falen. Bovendien
   bestaan er twee fase-11-bestanden: lifecycle en gecureerde varianten. Het eerste
   is geen bewijs dat het tweede is uitgevoerd.

4. **Fase-12-fout.** De oude verificatie noemt een kolom rechtstreeks voordat haar
   aanwezigheid gecontroleerd wordt. De ontbrekende kolom wijst op een onvolledige
   rollout. Het herstel voegt haar waar nodig toe; de nieuwe verificatie rapporteert
   de beginstate, kolomtypen en uiteindelijke functies.

5. **`practice_question_submissions` is geen verkeerde tabelnaam.**
   `phase11-curated-variants.sql` definieert haar expliciet. Een vraaguitkomst is
   iets anders dan mastery-evidence: een foutieve volledige vertaling geeft nul
   evidence, een multi-gapvraag kan meerdere rijen geven. De herstelmigration
   installeert de echte vraaguitkomststructuur én ingest/monitorfuncties wanneer ze
   ontbreken. `practice_attempts` en `practice_sessions` blijven intact.
   Historische vraaguitkomsten die nooit opgeslagen zijn, worden niet verzonnen
   of uit onvolledige evidence gereconstrueerd.

6. **Exacte migration.** Alleen `supabase/phase10-12-state-aware-upgrade.sql`.
   `scripts/build-state-aware-upgrade.js` genereert dit zelfstandige bestand
   reproduceerbaar uit de aanwezige historische definities en herstelregels.
   Het script maakt geen databaseverbinding.

7. **Ingebouwd databehoud.** Eén transactie, een transactioneel advisory lock,
   repeatable-read snapshot, tien seconden lock-timeout, typecontrole,
   integriteitsconstraints, RLS en expliciete grants. Voor bestaande tabellen
   worden aantallen en hashes van alle oorspronkelijke kolomwaarden vastgelegd
   en vóór commit vergeleken. Een verschil breekt de transactie af.
   Er worden geen leerlingrijen, pogingen, ronde-items of permanente ID's verwijderd.
   Functies worden niet gedropt of hernoemd om een installatie te forceren.

8. **Gewijzigde objecten.**
   `assignments`: beide oefenopties, en nullable historische maker zoals fase 11.
   `assignment_round_items`: `completion_kind` en bijbehorende constraint.
   `assignment_completions`: `reopened_at`; oorspronkelijke events blijven bestaan.
   `assignment_item_reports`: meldcycli, ruimere pogingarray, volledige-zinrichting,
   variant, modelantwoord, oefentype en pogingdetails.
   `practice_question_submissions`: vraaguitkomsten, ronde-anchor, evidence-ID's,
   linkversie en betrouwbare resultaten per gekoppeld doel.
   `assignment_completion_reopenings`: audit van terugsturen.
   `private.mon_parcours_upgrade_runs`: schema-inventaris en behoudsbewijs.
   Bestaande private wrappers, public RPC's en de bestaande attempt-triggerfunctie
   krijgen consistente definities. De bronstructuur van attempts/sessions,
   assignment- en ronde-ID's, mastery/evidence en de 1036 course-ID's blijft bestaan.
   Er was in de repository geen eigen migration-ledger; een eventuele Supabase-ledger
   wordt gedetecteerd, niet vervalst met verzonnen oude migratieregistraties.

9. **Defaults voor bestaande assignments.** Een ontbrekende
   `include_integrative_sentences` of `use_exercise_variants` krijgt `false`.
   Reeds aanwezige waarden blijven behouden. Ronden, itemselecties, deadlines,
   attempts, status en bestaande completion-timestamps worden tijdens de migration
   niet opnieuw berekend of gereset. Gepubliceerde oefenopties blijven vergrendeld.

10. **Assignment-variantselectie.** Nieuwe taken gebruiken standaard expliciet
    `use_exercise_variants=true` in de leerkrachtinterface. De gedeelde engine kiest
    alleen bronvarianten waarvan alle gekoppelde doelen in de resterende taakpool
    zitten. Gemengde grammatica vereist een passende gemengde pool. Volledige
    Révision-zinnen blijven een afzonderlijke opt-in. Bij ontbrekende geschikte
    varianten wordt de bestaande permanente oefenvorm gebruikt. Oude taken en
    actieve sessies blijven bruikbaar. Gecureerde multi-gapvragen scoren per gap;
    betrouwbare secundaire doelresultaten worden ook voor rondevoortgang opgeslagen.

11. **Mastery versus oefenvorm.** `course.json` bevat nog exact 1036 permanente
    items met dezelfde ID's. De statische bank heeft nog 1712 varianten, inclusief
    de bestaande mini-dialogen. Varianten en gegenereerde getallen vergroten geen
    masterydenominator. Een foutieve volledige zin geeft geen blanket negative
    evidence; een volledig correcte zin geeft positieve evidence aan haar gekoppelde
    doelen. Vraaguitkomsten worden één keer geteld, ongeacht het aantal evidence-rijen.
    Completion wordt pas geregistreerd nadat die vraaguitkomsten verwerkt zijn.

12. **Grammatica-scoping en regels.** Een smalle grammatica-scope vereist dat alle
    gevraagde doelen passen; gemengde varianten worden daar uitgesloten. De
    `cuisiner`-vraag verschijnt niet onder articles indéfinis. De T4-regelkolom
    bepaalt de mapping van onder meer `rapide → rapides` en `calme → calme`.
    De expliciet gemengde `les cheveux roux`-variant blijft gemengd.
    Vijf bestaande T4-vragen die een noun vragen terwijl het adjectief al gegeven
    is, blijven in Révision zonder adjectiefmastery. Regelvragen voor artikel- en
    possessiefcategorieën hebben gerichte keuzes; de twee aimer-regels vermelden
    vooraf welk soort antwoord verwacht wordt. UI-tellingen scheiden leerdoelen,
    oefenvarianten en mogelijke gegenereerde getallen.

13. **Getallen en niet-actieve onderdelen.** T4: 0–100, T5: 0–1000,
    T6: 0–100000, telkens één bestaand number_spec-doel. Sampling spreidt over
    bereiksegmenten. `septante/nonante` blijven primair; toegestane Franse vormen
    werken ook binnen honderden en duizenden. T6-jaartallen gebruiken de cursusvorm
    vóór 2000, met de klassieke volledige vorm als alternatief; vanaf 2000 de
    mille-vorm. Bij T5/T6 blijft een uitsluitend ontbrekend koppelteken een
    schrijffout, maar levert de correcte getalswaarde positieve evidence op.
    Accenten en woordvormen blijven strikt. Kiosque, alphabet en audio-only modules
    komen niet in nieuwe actieve pools; de zes T6-homofonen blijven actief.

14. **Probleemmeldingen.** Pas na twee echte foute inzendingen voor hetzelfde
    ronde-item/meldcyclus. Evidence per gap wordt niet als meerdere inzendingen
    geteld. Geen maximum aantal meldingen. `reported_pending` laat de leerling
    verdergaan, maar geeft geen evidence of beheersingspunten. Definitieve
    taakcompletion wacht op afhandeling. Goedkeuren geeft evenmin evidence.
    Terugsturen heropent alleen het betreffende item/ronde; latere ronde-items
    blijven bestaan en oude positieve pogingen kunnen het teruggestuurde item
    niet via replay weer afsluiten. QA toont ook afgehandelde cycli, met leerling,
    klas, taak, ronde, item, prompt, chronologische pogingen, accepted answers,
    model, oefentype, variant, Consulter, tijd en app-versie.

15. **`uf1-item-000077` en accepted answers.** De drie correcte antwoorden stonden
    al afzonderlijk in de dataset en blijven afzonderlijk geldig. Een exact
    `la salle` slaagt in de huidige validator; de historische afwijzing daarvan
    is zonder de oorspronkelijke ruwe poging/bundel niet bewezen.
    Wel was een eindpunt vóór trailing whitespace fout genormaliseerd; dat is
    hersteld en getest, samen met NBSP en verborgen Unicode-tekens.
    Meldcycli worden niet meer in één rij overschreven. De UI noemt elke poging
    afzonderlijk en toont haar prompt/variant. Externe synoniemen worden niet
    toegevoegd. Directe reproductie blijft doelgericht, inclusief de expliciete
    T4/T5-reactie-uitzonderingen uit de master. `trainer/traîner` en toegestane
    traditionele vervoegingen blijven geldig.

16. **Uitgevoerde tests.** Alle `tests/*.js` met de meegeleverde Node-runtime;
    syntaxcontrole van gewijzigde JavaScript-bestanden; reproduceerbare generatie
    van de variantbank en herstel-SQL; data-/ID-audit en SQL-contractcontrole.

17. **Geslaagd.** De volledige suite bevat 34 scripts. Ze controleert onder meer
    35/42 voortgang, bestaande ronde-items, teruggestuurde vroege rondes, varianten,
    volledige zinnen, per-gap evidence, meldgate, geen report-mastery,
    antwoordnormalisatie, scoping, gerichte regels, getallen, 1036 ID's en offline
    capabilitychecks. De statische SQL-test controleert herhaalbare DDL, een eindige
    wrapper-keten, behoudscontroles, grantgrenzen en consistente ingestmetadata.
    Dit is geen claim dat de SQL op PostgreSQL of productie uitgevoerd is.

18. **Open punten.** De echte PostgreSQL-integratietest blijft niet uitgevoerd.
    Zij bevat vijf startstates, herhaalde uitvoering, 35/42 behoud en RPC-tests
    voor nul-evidence-zinnen, pending meldingen, latere rondes en completion-audit.
    De exacte overige productieobjecten en de historische ruwe `la salle`-poging
    blijven onbekend. De migration legt de echte schema-beginstate vast en stopt
    bij onverwachte basis-/typeschema-afwijkingen. Productie-uitvoering en frontend-
    publicatie blijven jouw handmatige stappen.

## Verification-resultaat lezen

De ene verification-query geeft een JSON-object terug. Verwacht:

- `schema_ready`, `migration_finished`, `original_rows_verified_at_commit`: `true`;
- `missing_or_incompatible_columns`, `function_definition_drift`: lege arrays;
- `private_table_security`, `pending_uniqueness_index`, de RPC-grantchecks: `true`;
- `permanent_item_count`: `1036`;
- `row_counts`: de begin- en huidige aantallen; live activiteit mag aantallen verhogen;
- `starting_phase_state`: de werkelijk aangetroffen beginstate voor deze uitvoering.

Het behoudsbewijs wordt binnen de migrationtransactie vastgelegd. De verification
verwacht dus niet dat alle live tabelhashes na nieuwe leerlingactiviteit onveranderd
blijven. Oorspronkelijke completion-events kunnen na terugsturen blijven bestaan,
terwijl `reopened_at` aangeeft dat de taak opnieuw vereist is.
