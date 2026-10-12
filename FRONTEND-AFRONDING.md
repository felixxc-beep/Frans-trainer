# Frontendafronding — 12 oktober 2026

## Actuele afronding: brede scopes en gedeelde oefenpool

Nieuwe taken starten met Les, Blok, Subsection en Inhoudelijke categorie op
**Alles**. Bij een bewust gekozen les blijven alle onderliggende filters op
Alles totdat de leerkracht ze zelf vernauwt. De HTML markeert die lege
filterwaarden expliciet als geselecteerd. Een wijziging van een bovenliggend
filter wist de onderliggende filters en herstelt de volledige doelrange.

Voor Trajet 1 → Atelier Grammaire → L’article défini et indéfini:

| Selectie | Permanente doelen | Cursusregelvragen | Contextvarianten | Gemengde varianten |
| --- | ---: | ---: | ---: | ---: |
| Hele les, Blok/Subsection/Categorie = Alles | 12 | 12 | 56 | 32 |
| À retenir → On découvre ! → regel na aimer/adorer/détester | 2 | 2 | 27 | 0 |

`eligibleVariants` in `exercise-variants.js` is de gedeelde bron voor vrij
oefenen, teacher-categorieën en nieuwe assignmentpools. Variant-Trajet,
cursusscope, alle gekoppelde geselecteerde permanente IDs, de grammaticale
antwoorddoelen en subsectionbeperkingen worden gecontroleerd. De eerder
benoemde lexicale `T1-GRAM-AIMER-022` blijft uitgesloten. Daardoor is de actuele
On découvre-pool **27** op alle drie de plaatsen, in plaats van de oude 28 op
slechts de leerlingkaart. Cross-scope doelkoppelingen mogen geen extra doelen
in een pool binnensmokkelen. De bronbank houdt alle 1712 records; cursusdata
houden precies dezelfde 1036 permanente IDs.

De groene oefenbadges en Tout pratiquer tonen het variantenaantal wanneer er
varianten zijn. De tekst toont daarnaast expliciet bijvoorbeeld
`2 objectifs · 27 variantes d’exercice` en
`2 leerdoelen · 27 oefenvarianten`. Er wordt geen onduidelijke som van doelen
en varianten als oefenteller gebruikt.

Nieuwe taken bewaren categorieën, cursusscope, poolversie en oefenhoeveelheid
in de bestaande instructiemetadata. Zij bieden 10/20/30 of Alles waar dat
oefenvolume beschikbaar is en de geselecteerde doelen gedekt blijven. Bij de
smalle pool is Alles gelijk aan 27 concrete varianten; bij de brede selectie
zijn er 88 bankvarianten plus 12 cursusregelvragen wanneer alle drie vormen
worden aangevinkt. Gemengde vragen kunnen meerdere permanente doelen dekken.
De UI meldt wanneer doelen nog geen vraag in de gekozen vormen hebben.
Grote dynamische getalbereiken bieden 10/20/30; Alles is daarvoor beperkt tot
maximaal 101 mogelijke waarden, volgens de bestaande globale afspraak.

De runtime houdt alle geselecteerde poolvragen beschikbaar, ook nadat een
eerder antwoord hetzelfde permanente doel al heeft geraakt. Zij bewaart een
afzonderlijke lokale oefenteller en hervat onafgewerkte sessies met de resterende
vragen. Bestaande taken zonder de nieuwe poolmetadata behouden hun bestaande
vraagselectie en rondelogica.

**Validatie:** 38/38 scripts geslaagd; syntaxcontrole van de gewijzigde scripts.
Tests vergelijken brede en smalle scopes, Alles-defaults T1–T6, de variantsets
van teacher en vrij oefenen, de volledige 27-vragenruntime, hoeveelheden,
badges, getalbereiken en behoud van bestaande taken/voortgang. SQL en beide
data-JSON-bestanden zijn via hashes inhoudelijk ongewijzigd bevonden. Er is
geen SQL op een database uitgevoerd, geen runtime geïnstalleerd en niets
gepubliceerd.

**Grens zonder SQL-wijziging:** oefenvolume en vraagvolgorde worden door de
frontend toegepast. De bestaande server registreert taakcompletion op basis
van permanente ronde-items, niet op basis van de nieuwe hoeveelheidmetadata.
Die metadata vormt dus geen nieuwe server-side garantie dat een gekozen
oefenvolume voltooid is; bij tussentijdse synchronisatie kan de server eerder
completion registreren dan het einde van de volledige frontendpool. De
databasefunctie is volgens de opdracht niet aangepast. Een live browser- of
database-integratietest van deze uitbreiding is niet uitgevoerd.

**Upload:** vernieuwde `github-final-upload`, zes productiebestanden:
`app.js`, `teacher.js`, `exercise-policy.js`, **`exercise-variants.js`**,
`index.html`, `teacher.html`. De gedeelde engine moet deze keer mee geüpload
worden. Actuele cacheversie: **20261012-5**. Manifest en SHA-256-kopiecontrole
zijn bijgewerkt. De oudere controlepunten hieronder blijven als historiek staan.

## Aanvullende correctie: teacher-taakmaker

De volledige taakmaker toont nu een eigen sectie **4 · Oefenvormen**, direct
tussen leerdoelselectie en doel/deadline. Iedere bankcategorie toont haar aantal
geschikte oefenvarianten. Directe bronvragen worden apart als cursusvragen
geteld, niet als verzonnen bankvarianten. Ontbrekende bankcategorieën worden
weggelaten; een laadfout blijft zichtbaar in de sectie.

Bij Trajet 1 → Atelier Grammaire → L’article défini et indéfini → À retenir →
On découvre ! (beide leerdoelen geselecteerd) verschijnt:

- Grammatica · Règle / Regel herkennen of aanvullen — **2 cursusvragen**;
- Grammatica · En contexte / In een zin — **27 oefenvarianten**.

De bank markeert de genoemde `cuisiner`-situatie als `T1-GRAM-AIMER-022`, maar
deze wordt voor de nieuwe grammaticale taakselectie uitgesloten. Varianten uit
andere Trajets worden ook uitgesloten, zelfs bij gedeelde permanente doel-ID's.
De bank zelf en bestaande taken worden niet gewijzigd. Andere doelranges
berekenen onmiddellijk opnieuw welke categorieën en aantallen beschikbaar zijn.

De volledige renderer, het laden van de echte bank en het daadwerkelijke
`save_assignment`-pad zijn met een lokale RPC-stub getest. De geselecteerde enum
wordt in de bestaande versiegebonden instructiemetadata opgeslagen. De runtime
is voor de twee concrete T1-doelen getest met uitsluitend `grammar_context` en
uitsluitend `grammar_rule`: geen andere vraagtypes, twee masterydoelen.

**Actueel: 36/36 tests geslaagd**, plus syntaxcontrole van de gewijzigde scripts.
Geen SQL uitgevoerd, geen databasebestanden gewijzigd. De uploadmap en het
manifest zijn vernieuwd; de actuele HTML-cacheversie is **20261012-3**.
De hieronder beschreven 35-testcontrole en cacheversie 2 zijn het eerdere
controlepunt, niet de nieuwste versie.

De database wordt als klaar beschouwd op basis van de aangeleverde verificatie:
schema en grants correct, 1036 permanente IDs en oorspronkelijke rijen behouden.
Tijdens deze opdracht is geen SQL uitgevoerd of databasebestand gewijzigd.

1. **Oefenkeuzes.** Nieuwe rondetaken tonen beschikbare categorieën voor direct
   vertalen, vocabulaire in context, vervoegen, werkwoorden in een zin,
   grammaticaregels, grammatica in context, gemengde grammatica, integratieve
   Révision-zinnen en getallen. Directe cursuszinnen en schriftelijke homofonen
   zijn beschikbaar wanneer die doelen geselecteerd zijn. Geen individuele
   variantlijst. Een lege selectie of een selectie die doelen ontestbaar maakt
   blokkeert opslaan met een gerichte melding.
2. **Opslag zonder schemawijziging.** `exercise-policy.js` bewaart expliciete
   categoriecodes in een versiegebonden JSON-suffix van het bestaande
   `instructions`-veld: `[mon-parcours-exercise-policy-v1:…]`. De zichtbare
   instructies blijven gescheiden in beide interfaces. Instructies en metadata
   delen de bestaande grens van 1000 tekens; overschrijding wordt vóór opslaan
   gemeld. De twee bestaande serverflags worden uit de keuzes afgeleid.
3. **Runtime.** Alleen gekozen categorieën leveren vragen. De engine kiest
   passende bronvarianten; bij meerdere toepasbare categorieën wisselt zij per
   ronde. Eén permanente ronde-anchor blijft één doel. Bestaande taken zonder
   metadata blijven de eerdere runtime gebruiken. Publicatie vergrendelt de
   keuzes in de taakmaker. Voor ronde 3–4 moet ieder doel ook afzonderlijk
   oefenbaar zijn, zodat een kleinere reviewset kan worden uitgevoerd.
4. **Labels.** Trajetkaarten tonen actieve permanente `objectifs / leerdoelen`.
   Varianten heten `variantes d’exercice / oefenvarianten`; Révision-vragen
   `exercices / oefeningen`. Sessies tellen oefeningen, de taakmaker en het
   teacherdetail tellen leerdoelen. Cursusonderdelen blijven onderdelen heten
   wanneer het navigatiegroepen betreft. Inactieve inhoud blijft cursusinfo.
5. **Scoping.** De taakselectie gebruikt dezelfde `matchesScope`-helper als vrij
   oefenen. Alle variantdoelen moeten in de huidige rondeselectie zitten;
   subsectionbeperkingen blijven gelden. Gemengde grammatica vereist een
   gemengde selectie. Lexicale contextvragen worden niet als grammatica
   aangeboden. `cuisiner` verschijnt niet bij articles indéfinis.
6. **Grammar-rule UX.** De bestaande gerichte aimer-vragen zijn gecontroleerd:
   vóór de eerste poging staan het gat, de instructie welke vorm gevraagd wordt
   en de antwoordkeuzes zichtbaar. Artikelcategorieën gebruiken gerichte keuzes.
   Deze inhoud was al aanwezig en is niet opnieuw verzonnen.
7. **Getallen en actieve inhoud.** T4 0–100, T5 0–1000 en T6 0–100000 behouden
   ieder één dynamisch cursusdoel. De runtime genereert binnen dat bereik en
   bewaart de bestaande T6-jaartalvorm. Kiosque, alphabet en uitgesloten
   klankmodules blijven buiten actieve pools; de zes schriftelijke T6-homofonen
   blijven actief. Course- en variantdata zijn inhoudelijk ongewijzigd.
8. **Controles.** 35/35 regressies geslaagd, inclusief opslag/teruglezen,
   onveranderde legacyflags, geselecteerde/uitgesloten vormen, grammatica-scope,
   9/42 en 35/42 voortgang, getallen, labels T1–T6, grammar-rule-instructies en
   onveranderde masterydenominator. Node-syntaxcontrole geslaagd. Resultaten:
   `tmp/frontend-test-results.json`; deze lokale output zit niet in de upload.
9. **Productie-upload.** Upload de inhoud van `github-final-upload` vanuit de
   repositoryroot: `app.js`, `teacher.js`, `exercise-policy.js`, `index.html`,
   `teacher.html`. De HTML verwijst naar cacheversie `20261012-2`. De bestaande
   `exercise-variants.js` en variantbank moeten al in de repository staan, zoals
   in de eerdere uploadset. Het manifest bevat SHA-256 per bestand.
10. **Beperkingen.** Er is geen live browser-/Supabase-opslagtest of GitHub-upload
    uitgevoerd. Categorieopslag en -filtering zijn frontendfunctionaliteit: de
    bestaande server valideert haar twee flags, niet de JSON-categoriecodes.
    Alle clients moeten de bijgewerkte frontend gebruiken; een oudere client
    kan het metadatasuffix tonen en kent de fijnmazige selectie niet. De keuze
    voor het bestaande instructieveld voorkomt een nieuwe databasewijziging.

De nieuwe regressies blijven in de werkmap voor onderhoud; de uploadbundle
bevat uitsluitend de vijf gewijzigde/nieuwe productiebestanden.
