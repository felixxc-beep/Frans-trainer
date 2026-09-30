# Mon parcours — Univers français 1

Een leerlingvriendelijke, statische studietool voor Franse woordenschat, zinnen, werkwoorden, grammatica en getallen. De app gebruikt uitsluitend de inhoud uit `data/course.json`. Voortgang blijft altijd lokaal beschikbaar en kan optioneel naar Supabase synchroniseren.

## Wat zit erin?

- De exacte cursusvolgorde van Trajet → cursusonderdeel → studieblok → subsectie.
- Leren, Oefenen en Test jezelf.
- Woordenschat in beide richtingen.
- Werkwoordinfinitieven en vervoegingen met alle personen uit de bron.
- Franse zinnen, grammaticaregels en getallen.
- Strenge beoordeling van accenten.
- Accentknoppen bij elk antwoordveld.
- Fout-herhaling, moeilijke woorden, voortgang per Trajet en categorie en verder oefenen.
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

Elk leeritem heeft daarnaast een permanente `id`. Voer na het toevoegen van nieuwe items één keer `node scripts/assign-stable-item-ids.js` uit. Het script vult alleen ontbrekende IDs aan vanaf het hoogste bestaande nummer en verandert nooit bestaande IDs.

## Optionele Supabase-synchronisatie

- `student-identity.js` is de centrale, verwisselbare identificatielaag.
- `supabase-client.js` doet alleen begrensde RPC-aanroepen.
- `sync-manager.js` bewaart mislukte verzendingen in `monParcoursSyncQueueV1` en probeert ze later opnieuw.
- `config.js` bevat uitsluitend de Project URL en publishable key.
- Zonder geldige configuratie werkt de trainer volledig lokaal verder.

De volledige installatiehandleiding staat in `supabase/README.md`.

De JavaScript-code hoeft voor Trajet 4, 5 enzovoort niet te worden aangepast zolang dezelfde datastructuur behouden blijft.

## Bestanden

- index.html — basisstructuur en instellingen
- styles.css — vormgeving en responsive gedrag
- app.js — navigatie, oefenlogica en localStorage
- student-identity.js — modulaire leerlingidentiteit
- supabase-client.js — optionele publieke Supabase-RPC-client
- sync-manager.js — offline outbox en idempotente synchronisatie
- config.js — publieke Supabase-configuratie
- data/course.json — alle cursusinhoud
- supabase/ — database, functies, RLS en optionele testdata
- tests/full-audit.js — volledige controle tegen de cursusbron
- tests/github-pages-audit.js — controle voor buildloze hosting onder een repositorysubpad
- tests/smoke.js — snelle logica- en antwoordcontrole
- .nojekyll — voorkomt ongewenste Jekyll-verwerking op GitHub Pages

## Privacy

Zonder leerlingkoppeling staat voortgang alleen in localStorage van de gebruikte browser. Bij een gekoppelde leerling worden uitsluitend pseudonieme identificatie, oefensessies en pogingen gesynchroniseerd. Er worden geen geboortedatum, privé-e-mailadres, adres of leerlingwachtwoord gevraagd. De browser bevat nooit een secret/service-role key.
