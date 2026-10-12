# Mon parcours — Univers français 1

**Gedeeltelijke rollout 10–12:** gebruik het herstelpad in
`HERSTELRAPPORT-FASEN-10-12.md`. Voer de oorspronkelijke eenmalige migraties daarvoor
niet opnieuw uit. PostgreSQL-uitvoering van het nieuwe bestand is nog niet getest.

Een leerlingvriendelijke, statische en tweetalige studietool voor Franse woordenschat, zinnen, werkwoorden, grammatica en getallen. De 1.036 permanente leeritems staan onveranderd in `data/course.json`; de aparte bank `data/exercise-variants.json` bevat 1.735 gecureerde oefenvarianten voor Trajet 1–6. Een leerling meldt zich vóór het oefenen aan met de gekoppelde schoolmail; daarna blijft oefenen bij tijdelijke internetuitval mogelijk via localStorage en de offline syncqueue.

## Wat zit erin?

- De exacte cursusvolgorde van Trajet → cursusonderdeel → studieblok → subsectie.
- Leren, Oefenen en Test jezelf.
- Woordenschat in beide richtingen.
- Werkwoordinfinitieven en vervoegingen met alle personen uit de bron.
- Franse zinnen, grammaticaregels en getallen.
- Zes volledige Trajets met 1.036 permanent geïdentificeerde bronitems.
- Strenge beoordeling van accenten.
- Accentknoppen bij elk antwoordveld.
- Fout-herhaling, moeilijke woorden, voortgang per Trajet en categorie en verder oefenen.
- Een afgeleid beheersingsmodel met Nieuw, Aan het leren en Gekend; Gekend vereist drie correcte zelfstandige antwoorden, 75% correct, twee sessies en een laatste juiste poging.
- Een afzonderlijk continu beheersingsniveau van 0–100 dat al tijdens de eerste sessie stijgt, fouten meeweegt en alleen voor strikt Gekende items 100% bereikt.
- Synoniemen met dezelfde Nederlandse prompt binnen dezelfde JSON-subsectie worden als gelijkwaardige antwoorden aanvaard.
- Responsive ontwerp voor laptop, Chromebook, tablet en smartphone.

## Herkende datastructuur

De cursusbron heeft drie niveaus voor navigatie en een aparte lijst met leeritems:

1. course
2. trajectories
3. units met top_category, title en study_sections
4. study_sections met subsections en content_types
5. items die via top_category, lesson, block en subsection aan die structuur gekoppeld zijn

De ondersteunde itemtypes zijn vocabulary, verb, phrase, grammar_rule, number en sound_rule. Audio-only klankregels worden als cursusinfo getoond; de zes T6-homofonen onder Comment écrire ? zijn wél schriftelijke oefeningen op bestaande sound_rule-items.

## Gecureerde oefenvarianten (faseblok 2)

`exercise-variants.js` valideert en beoordeelt varianten. Elk record in `data/exercise-variants.json` heeft een uniek `id`, een `trajectory`, een `kind` (`translate`, `context`, `actes`, `conjugation`, `grammar`, `revision` of `number`), een `scoring` (`single`, `multi_gap` of `integrative`) en een `prompt`. Een enkelvoudige of integratieve vraag bevat expliciete `accepted_answers` en `targets` met bestaande permanente item-ID's. Een meer-gatenvraag bevat per `___` een `gaps`-record met eigen `id`, `accepted_answers` en `targets`. Optioneel zijn `instruction`, `context`, `exercise_key`, `item_variant` en `requires_question_mark` beschikbaar. De bank wordt tegen `course.json` gevalideerd; onbekende mappings, dubbele variant-ID's en lege antwoorden worden geweigerd.

De gecureerde bank is mechanisch uit de aangeleverde master spec gemaakt met `node scripts/import-master-variants.js <pad-naar-master-spec.md>`. Elke variant bewaart het bronregelnummer. De 1.678 bron-tabelregels en 36 expliciete mini-dialogen leveren 1.735 actieve varianten op; `T6-VOC-CTX-046` heeft geen permanent doelitem voor `ordinateur`, en `T3-REV-033` heeft volgens de bron een dubbelzinnig open gat zonder vaste cue. Deze twee zijn daarom niet actief. De bronvervanging voor `T4-PR-020`, `T5-POSS-MIX-004` en `T6-Q-ECQW-008` is toegepast. T1-voornaamwoordvarianten zijn oefenbaar, maar registreren geen misleidende werkwoordmastery omdat daarvoor geen afzonderlijk permanent voornaamwoorddoel bestaat.

De nieuwe vormen staan in de bestaande cursusonderdelen. Per contenttype blijven de twee hoofdvormen direct zichtbaar; aanvullende legacy-richtingen staan onder **Meer oefenvormen** en blijven bruikbaar. De bestaande Action-/Révision-onderdelen zijn afzonderlijk oefenbaar en hebben een terughoudende, consistente visuele accentkleur. T6 `a/à`, `ou/où` en `la/là` zijn via Comment écrire ? actief; audio-only Comment dire ?-onderdelen blijven cursusinfo. De legacy-oefenvormen, taken, rondes, dynamische getallen en vaste IDs blijven intact. De Révision-bank bevat per Trajet 30, 30, 34, 35, 36 en 48 oefenvarianten. De expliciet gedocumenteerde regionale getalvormen worden ook daar geaccepteerd.

Een meer-gatenvraag levert afzonderlijke evidence per gat. Een integratieve vertaling levert alleen bij een volledig juist antwoord positieve evidence voor alle gekoppelde doelen; een fout antwoord wordt als fout in de sessie geteld, maar levert geen negatieve evidence voor de gekoppelde mastery-items. De nieuwe `phase11-curated-variants.sql`-migratie bewaart de werkelijke vraaginzendingen idempotent, houdt de sessietellers los van de evidencerijen en corrigeert de klasmonitor zodat een meer-gatenvraag als één gemaakte oefening telt. Voer die migratie uit vóór publicatie; zonder migratie blijven gecureerde resultaten veilig in de lokale syncqueue. De migratie is nog niet op een live database uitgevoerd.

## Lokaal testen

Omdat de cursus via fetch wordt geladen, moet de map via een kleine lokale webserver worden geopend.

Met Python:

1. Open PowerShell in deze projectmap.
2. Voer uit: python -m http.server 8000
3. Open http://localhost:8000 in je browser.
4. Stop de server met Ctrl+C.

Je kunt ook de extensie Live Server in Visual Studio Code gebruiken.

## Controles uitvoeren

Met Node.js kun je de ingebouwde controles uitvoeren:

1. node tests/smoke.js
2. node tests/full-audit.js
3. node tests/github-pages-audit.js
4. node tests/session-regression.js
5. node tests/phase2-sync.js
6. node tests/phase2-security-audit.js
7. node tests/actes-de-parole-regression.js
8. node tests/identity-button-regression.js
9. node tests/trajectories-4-6-regression.js
10. node tests/mastery-regression.js
11. node tests/teacher-dashboard-regression.js
12. node tests/phase4-management-regression.js
13. node tests/phase5-school-email-regression.js
14. node tests/phase5b-active-time-regression.js
15. node tests/phase6-multi-teacher-regression.js
16. node tests/bilingual-student-ui-regression.js
17. node tests/final-ux-redesign-regression.js
18. node tests/supabase-browser-client-regression.js
19. node tests/master-content-phase2.js
20. node tests/curated-sync-regression.js

Dit is een selectie; voer voor de complete regressieronde alle `tests/*.js` met Node.js uit. De volledige audit controleert alle trajecten en cursusonderdelen, de koppeling van studieblokken en subsecties, alle werkwoordvervoegingen, expliciete alternatieve antwoorden en synoniemgroepen. De GitHub Pages-audit controleert de rootstructuur, relatieve assets, subpadwerking, localStorage en de afwezigheid van een backend of buildstap. De master-contenttest controleert ook de zes afzonderlijke Révision-onderdelen, sessiegroottes, regionale getalalternatieven en gerichte mastery-mappings.

## Publiceren via GitHub Pages

1. Maak een nieuwe GitHub-repository.
2. Upload alle bestanden uit deze map, inclusief de map data en het bestand .nojekyll.
3. Open in GitHub: Settings → Pages.
4. Kies bij Build and deployment voor Deploy from a branch.
5. Kies je hoofdbranch, meestal main, en de map /(root).
6. Klik op Save. GitHub toont daarna de publieke URL.

Alle verwijzingen zijn relatief, zodat de app ook correct werkt onder een GitHub Pages-projectadres.
Een repository met de naam frans-trainer werkt dus rechtstreeks op een adres dat eindigt op /frans-trainer/.

## Nieuwe Trajets toevoegen

Voeg nieuwe cursusdata toe aan de array trajectories in data/course.json. Gebruik dezelfde velden als de bestaande Trajets:

- trajectory en units voor de zichtbare cursusstructuur;
- items voor de leerinhoud;
- top_category, lesson, block en subsection om elk item aan de juiste plaats te koppelen;
- accepted_answers wanneer meerdere antwoorden correct zijn;
- conjugations met subject en form voor werkwoorden.
- één dynamisch number-item met `dynamic_range`, `range` en een permanent ID voor grote getalbereiken.

Elk leeritem heeft daarnaast een permanente `id`. Voer na het toevoegen van nieuwe items één keer `node scripts/assign-stable-item-ids.js` uit. Het script vult alleen ontbrekende IDs aan vanaf het hoogste bestaande nummer en verandert nooit bestaande IDs.

## Leerlingidentificatie en Supabase-synchronisatie

- `student-identity.js` is de centrale, verwisselbare identificatielaag.
- `supabase-client.js` doet alleen begrensde RPC-aanroepen.
- `sync-manager.js` bewaart mislukte verzendingen in `monParcoursSyncQueueV1` en probeert ze later opnieuw.
- `mastery.js` bevat zowel de gedeelde statusdefinitie als het continue beheersingsniveau. De bewijswaarde is 10% na alleen Leren, 40% na één, 60% na twee en 75% na drie correcte zelfstandige antwoorden; extra correcte antwoorden bouwen beperkt verder op. Die waarde wordt vermenigvuldigd met de zelfstandige nauwkeurigheid, blijft voor niet-Gekende items tussen 10% en 90%, en wordt alleen bij status Gekend 100%. De zichtbare noemer telt elk permanent `item.id` exact één keer; oefenrichtingen, vervoegingspersonen en dynamische getalvarianten leveren bewijs voor dat item maar maken geen extra leeritems. `monParcoursMasteryAttemptsV1` bewaart alleen de minimale lokale, nog te verzoenen pogingsmetadata en nooit getypte antwoorden.
- Het leerkrachtendashboard gebruikt Supabase Auth met server-side rollen en many-to-many klastoegang via `teachers` en `class_teachers`.
- De klasmonitor kan 15, 30 of 60 minuten, vandaag, gisteren, 7 dagen, 30 dagen of alle resultaten tonen. Bij een gekozen klas blijven alle actieve leerlingen zichtbaar, ook zonder activiteit; korte periodes vernieuwen om de 30 seconden zolang het tabblad zichtbaar is.
- `config.js` bevat uitsluitend de Project URL en publishable key.
- Een nieuwe leerling moet zich eenmaal online met een actieve schoolmailidentiteit koppelen voordat oefenen mogelijk is.
- Een eerder gekoppelde leerling kan bij tijdelijke internetuitval blijven oefenen; resultaten wachten dan in de lokale syncqueue.
- De leerlingcode blijft uitsluitend als technische hersteloptie beschikbaar en start op zichzelf geen nieuwe normale sessie.

De volledige installatiehandleiding staat in `supabase/README.md`.

Gewone nieuwe Trajets vereisen geen JavaScript-aanpassing zolang dezelfde datastructuur behouden blijft. Grote getalbereiken worden tijdens een sessie gegenereerd en hoeven niet als duizenden losse JSON-items te worden opgeslagen. Bij dynamische bereiken tot en met 101 getallen kan de leerling alles kiezen; grotere bereiken bieden sessies van 10, 20 of 30 getallen aan.

## Bestanden

- index.html — basisstructuur en instellingen
- styles.css — vormgeving en responsive gedrag
- app.js — navigatie, oefenlogica en localStorage
- student-identity.js — modulaire leerlingidentiteit
- supabase-client.js — optionele publieke Supabase-RPC-client
- sync-manager.js — offline outbox en idempotente synchronisatie
- mastery.js — centrale, herbruikbare berekening van Nieuw / Aan het leren / Gekend
- config.js — publieke Supabase-configuratie
- data/course.json — alle cursusinhoud
- supabase/ — database, functies, RLS en optionele testdata
- tests/full-audit.js — volledige controle tegen de cursusbron
- tests/github-pages-audit.js — controle voor buildloze hosting onder een repositorysubpad
- tests/smoke.js — snelle logica- en antwoordcontrole
- .nojekyll — voorkomt ongewenste Jekyll-verwerking op GitHub Pages

## Privacy

De schoolmail wordt alleen aan de Supabase-RPC doorgegeven om het bestaande leerlingprofiel te vinden en staat niet in localStorage, oefensessies, pogingen of de syncqueue. Centraal worden uitsluitend de interne leerling-ID, oefensessies en pogingen bewaard. Letterlijk getypte antwoorden worden niet centraal opgeslagen. De browser bevat nooit een secret/service-role key.
# Herstel van gedeeltelijk uitgerolde fases 10–12

Voor de huidige gedeeltelijke productie-state: gebruik uitsluitend
`supabase/phase10-12-state-aware-upgrade.sql`, gevolgd door
`supabase/phase10-12-state-aware-verification.sql`. De afzonderlijke eenmalige
fase-10/11/12-bestanden worden voor dit herstel niet opnieuw uitgevoerd.

Zie `HERSTELRAPPORT-FASEN-10-12.md` voor wijzigingen, defaults, testresultaten en
de beperking van de nog niet uitgevoerde PostgreSQL-integratietest. Productie-SQL
wordt uitsluitend handmatig door de beheerder uitgevoerd.

