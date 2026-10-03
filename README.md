# Mon parcours — Univers français 1

Een leerlingvriendelijke, statische en tweetalige studietool voor Franse woordenschat, zinnen, werkwoorden, grammatica en getallen. De app gebruikt uitsluitend de inhoud uit `data/course.json`. Een leerling meldt zich vóór het oefenen aan met de gekoppelde schoolmail; daarna blijft oefenen bij tijdelijke internetuitval mogelijk via localStorage en de offline syncqueue.

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
- Synoniemen met dezelfde Nederlandse prompt binnen dezelfde JSON-subsectie worden als gelijkwaardige antwoorden aanvaard.
- Responsive ontwerp voor laptop, Chromebook, tablet en smartphone.

## Herkende datastructuur

De cursusbron heeft drie niveaus voor navigatie en een aparte lijst met leeritems:

1. course
2. trajectories
3. units met top_category, title en study_sections
4. study_sections met subsections en content_types
5. items die via top_category, lesson, block en subsection aan die structuur gekoppeld zijn

De ondersteunde itemtypes zijn vocabulary, verb, phrase, grammar_rule, number en sound_rule. Klankregels worden als cursusinfo getoond; de andere types kunnen oefeningen opleveren.

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

De volledige audit controleert alle trajecten en cursusonderdelen, de koppeling van studieblokken en subsecties, alle werkwoordvervoegingen, expliciete alternatieve antwoorden en synoniemgroepen. De GitHub Pages-audit controleert de rootstructuur, relatieve assets, subpadwerking, localStorage en de afwezigheid van een backend of buildstap.

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
- `mastery.js` bevat de gedeelde statusdefinitie voor leerlingtool en dashboard; `monParcoursMasteryAttemptsV1` bewaart alleen de minimale lokale, nog te verzoenen pogingsmetadata en nooit getypte antwoorden.
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
