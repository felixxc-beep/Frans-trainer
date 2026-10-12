# MON PARCOURS — MASTER CONTENT SPEC
## Univers français 1 — Trajets 1 à 6

**Status:** inhoudelijke bron van waarheid voor implementatie  
**Doel:** één bestand voor Codex met alle goedgekeurde inhoud en implementatieregels van Trajet 1 t.e.m. 6.  
**Belangrijk:** Codex implementeert deze specificatie; Codex genereert niet zelfstandig nieuwe didactische inhoud.

---

# A. Niet-onderhandelbare globale regels

## A1. Bestaande cursusdata blijven stabiel
De bestaande **1036 permanente course-items** blijven behouden met exact dezelfde permanente item-ID's.

| Trajet | Permanente items |
|---|---:|
| Trajet 1 | 182 |
| Trajet 2 | 148 |
| Trajet 3 | 235 |
| Trajet 4 | 170 |
| Trajet 5 | 144 |
| Trajet 6 | 157 |
| **Totaal** | **1036** |

Nieuwe oefenzinnen, contextvragen, dialoogvarianten, vervoegingsvarianten en integratieve oefeningen zijn **exercise variants**, geen nieuwe permanente mastery-items.

## A2. De cursusstructuur is leidend
Behoud de bestaande structuur:
**Trajet → categorie → les → À retenir → On se rappelle ? / On découvre ! / Actes de parole.**

De specificaties hieronder mogen nieuwe oefenvormen toevoegen, maar mogen de cursusinhoud niet willekeurig herstructureren.

## A3. Geen automatische didactische generatie
Codex mag:
- de gecureerde banken uit dit bestand technisch omzetten naar data;
- gecontroleerde dynamische varianten genereren waar dat expliciet is toegestaan, vooral getallen en bestaande vervoegingspatronen.

Codex mag **niet**:
- zelf nieuwe contextzinnen bedenken;
- zelf nieuwe grammatica toevoegen;
- zelf extra accepted answers verzinnen;
- nieuwe permanente mastery-items aanmaken;
- leerstof uit latere Trajets naar eerdere Trajets verschuiven.

## A4. Oefenmodi
**Apprendre / Leren**
- begeleid;
- korte regel/microfeedback;
- na fout mag gerichte uitleg verschijnen;
- telt niet als onafhankelijke mastery-evidence.

**S’entraîner / Oefenen**
- zelfstandig;
- geen antwoord vooraf;
- gerichte hint pas na fout;
- telt als onafhankelijke evidence.

**Se tester / Test jezelf**
- geen hints tijdens de reeks;
- feedback op het einde;
- telt als onafhankelijke evidence.

## A5. Antwoordcorrectie
- accenten strikt;
- `'` en `’` equivalent;
- hoofdletter aan het begin is niet doorslaggevend;
- ontbrekend eindpunt maakt een inhoudelijk correct antwoord niet automatisch fout;
- gebruik expliciete `accepted_answers`;
- geen brede fuzzy/AI-correctie;
- communicatieve alternatieven alleen waar de specifieke Actes-de-parole-context dat toestaat.

## A6. Ambiguity rule
Voor elke open contextvraag:
> Als een ander actief leerwoord uit dezelfde scope logisch in hetzelfde gat past, herschrijf of schrap de variant.

Liever geen contextoefening dan een dubbelzinnige contextoefening.

## A7. Mastery en scoring
- Variants leveren bewijs voor bestaande doelen.
- Multi-gap: elk gat afzonderlijk beoordelen en evidence registreren.
- Volledige vertaalzin volledig correct → positieve evidence voor gekoppelde doelen.
- Volledige vertaalzin fout → de integratieve vraag telt fout, maar **geen blanket negative mastery** voor alle gekoppelde doelen.
- Apprendre telt niet als onafhankelijke evidence.
- Bestaande mastery-/round-/task-architectuur blijft behouden.

## A8. UI-principe
**Keep it simple.**
Frans primair, Nederlandse vertaling klein/cursief.
Geen overdaad aan tegels of oefenmodi.
Gebruik binnen contenttypes maximaal enkele duidelijke hoofdvormen en kleine labels/filters voor moeilijkheid.

## A9. Uitspraak/audio
Echte uitspraak-/klankmodules zonder audio worden niet actief aangeboden.
Uitzondering: T6 `a/à`, `ou/où`, `la/là` zijn inhoudelijk spelling/homofonen en blijven actief, ook al zijn ze technisch als `sound_rule` opgeslagen.

## A10. Definitieve vervangingen
Sommige trajectspecificaties documenteren tijdens hun kwaliteitscontrole een oude draftvariant en daarna een expliciete vervanging.
**De expliciet genoemde definitieve vervanging is altijd autoritatief.**
Een regel die letterlijk zegt dat een variant niet in de definitieve data mag worden opgenomen, mag niet worden geïmplementeerd.

---

# B. Implementatievolgorde voor Codex

Voer dit bij voorkeur gefaseerd uit:

1. **Data-laag**
   - voeg exercise-variantdata toe zonder permanente item-ID's te wijzigen;
   - leg mapping variant → bestaande masterydoelen vast;
   - maak datavalidatie voor unieke variant-ID's.

2. **Generieke exercise engines**
   - Traduire;
   - En contexte;
   - Actes de parole;
   - werkwoord/conjugatie;
   - grammatica multi-gap;
   - integratieve Révision;
   - gecontroleerde number generator.

3. **Trajet 1 t.e.m. 6 aansluiten**
   - gebruik uitsluitend de banken en regels hieronder.

4. **Mastery / evidence**
   - controleer dat multi-gap per gat registreert;
   - controleer dat integratieve vertalingen geen blanket negative evidence geven;
   - behoud legacy mastery en round-systemen.

5. **UI**
   - eenvoudige consistente keuzestructuur;
   - geen nieuwe grote navigatielaag per microregel.

6. **Validatie**
   - alle variant-ID's uniek;
   - permanente item-ID's onveranderd;
   - geen lege accepted-answer sets;
   - geen variant zonder mapping;
   - geen number-variant als permanent item;
   - geen verborgen T6-homofonen;
   - geen audio-only onderdelen zichtbaar zonder audio.

---

# C. Globale technische QA van deze master

- Permanente course-items verwacht: **1036**
- Gecureerde variant-ID's gevonden in de zes specs: **1678**
- Unieke gecureerde variant-ID's: **1678**
- Dubbele variant-ID's over Trajet 1–6: **0**
- Per Trajet getelde variant-ID's:
  - T1: 347
  - T2: 213
  - T3: 222
  - T4: 287
  - T5: 277
  - T6: 332

---

# D. Trajet-specificaties

Hieronder volgen de zes oorspronkelijke, goedgekeurde content-specs.  
Bij conflict tussen algemene herhalingstekst en een specifieke trajectregel geldt:
1. de **traject-specifieke inhoud** voor dat Trajet;
2. de **globale veiligheids-/dataregels** hierboven voor ID-stabiliteit, mastery, ambiguïteit en geen AI-generatie.



---

# SOURCE CONTENT — TRAJET 1

# Mon parcours — Trajet 1 Content Spec
Version: checkpoint v1 — inhoudelijk goedgekeurd voor implementatie
Doel: bronbestand voor Codex. Codex mag de didactische inhoud niet zelf uitbreiden of herschrijven zonder expliciete instructie.

---

## 0. Algemene principes

### 0.1 Structuur
De bestaande cursusstructuur blijft behouden:
Trajet → categorie → les → À retenir → On se rappelle ? / On découvre ! / Actes de parole.

De bestaande permanente course-items en hun item-ID's blijven onaangeroerd.
Nieuwe oefenvarianten hieronder zijn **geen nieuwe permanente mastery-items**.

### 0.2 Oefenmodi
- **Apprendre / Leren**
  - begeleid
  - korte regel of micro-uitleg mogelijk
  - na een fout mag gerichte feedback verschijnen
  - telt niet als onafhankelijke mastery-evidence
- **S'entraîner / Oefenen**
  - onafhankelijke oefening
  - geen antwoord vooraf
  - gerichte hint pas na fout
  - telt als onafhankelijke evidence
- **Se tester / Test jezelf**
  - geen hints tijdens de oefening
  - feedback op het einde
  - telt als onafhankelijke evidence

### 0.3 Antwoordregels
- Accenten zijn strikt.
- Rechte apostrof `'` en typografische apostrof `’` worden als gelijkwaardig behandeld.
- Beginhoofdletter hoeft een inhoudelijk correct antwoord niet fout te maken.
- Ontbrekend eindpunt hoeft een inhoudelijk correct antwoord niet fout te maken.
- Gebruik expliciete `accepted_answers` waar echte equivalenten bestaan.
- Geen brede fuzzy matching die inhoudelijk andere Franse woorden zomaar accepteert.
- Bij bijna-correcte spelling mag een gerichte hint verschijnen.
- Elke open contextvraag krijgt een **ambiguity check**:
  - als een ander actief leerwoord logisch in hetzelfde gat past, herschrijven of schrappen.

### 0.4 Mastery
- Oefenvarianten leveren bewijs voor bestaande doelen.
- Ze worden zelf geen nieuwe mastery-items.
- Integratieve vragen kunnen bewijs leveren voor meerdere onderliggende doelen.
- Bij volledige vertaalzinnen geldt:
  - volledig correct → positieve evidence voor gekoppelde doelen;
  - niet volledig correct → de integratieve zin is fout, maar niet automatisch negatieve evidence voor alle onderliggende doelen.
- Bij meer-gatenvragen wordt elk gat apart beoordeeld.

### 0.5 Uitgesloten uit Mon parcours in Trajet 1
- L'alphabet: geen digitale oefenbank.
- Comment dire ? / sons: geen digitale oefenbank zolang er geen audiofunctionaliteit gebruikt wordt.
- Kiosque: voorlopig geen aparte mastery-/oefenbank.

---

# 1. Vocabulaire

## 1.1 Oefenvormen

### Traduire / Vertalen
Bestaande FR↔NL-oefenvorm blijft behouden.

Regels:
- zelfstandige naamwoorden worden met lidwoord geleerd;
- werkwoorden kunnen lexicaal als infinitief worden gevraagd;
- lexicale kennis van een werkwoord staat los van zijn vervoegingsmastery.

### En contexte / In een zin
Nieuwe gecureerde bank met Franse contextzinnen.

Regels:
- geen Nederlandse target tussen haakjes;
- context moet naar één logisch antwoord leiden;
- bij zelfstandige naamwoorden staat het artikel meestal al in de zin;
- alleen woorden met een natuurlijke, eenduidige context krijgen dit oefentype;
- een vormvariant mag naar hetzelfde mastery-item mappen, bv. `le degré` → antwoord `degrés`;
- vaste werkwoordgroepen worden volledig uitgelokt, bv. `écouter de la musique`.

## 1.2 Problematische equivalenten
Niet naïef als één uniek NL→FR-antwoord behandelen:
- `le hobby` / `le loisir`
- `ami` / `copain`
- `amie` / `copine`
- `an` / `année`

Strikt onderscheiden:
- `la basket` = schoen/sneaker
- `le basket` = basketbal

---

## 1.3 En contexte — definitieve basisbank

### On se rappelle ?

| ID | Prompt | Antwoord |
|---|---|---|
| T1-VOC-CTX-001 | Quel est ton ___ ? — J’ai douze ans. | âge |
| T1-VOC-CTX-002 | Aujourd’hui, j’ai treize ans. C’est mon ___. | anniversaire |
| T1-VOC-CTX-003 | Pour jouer au foot, j’utilise un ___. | ballon |
| T1-VOC-CTX-004 | La ___ est un fruit jaune. | banane |
| T1-VOC-CTX-005 | Je mets une ___ à mon pied. | basket |
| T1-VOC-CTX-006 | Au ___, on marque des paniers. | basket |
| T1-VOC-CTX-007 | Mon ___ fait « miaou ». | chat |
| T1-VOC-CTX-008 | Mon ___ fait « ouaf ». | chien |
| T1-VOC-CTX-009 | Je vais au ___ pour regarder un film. | cinéma |
| T1-VOC-CTX-010 | Je suis en 1B. 1B est ma ___. | classe |
| T1-VOC-CTX-011 | Le matin, les élèves vont à l’___. | école |
| T1-VOC-CTX-012 | Emma est la ___ de monsieur et madame Martin. | fille |
| T1-VOC-CTX-013 | Lucas est le ___ de monsieur et madame Martin. | fils |
| T1-VOC-CTX-014 | Tom et moi avons les mêmes parents. Tom est mon ___. | frère |
| T1-VOC-CTX-015 | Dupont est mon ___ de famille. | nom |
| T1-VOC-CTX-016 | Je m’appelle Emma. Emma est mon ___. | prénom |
| T1-VOC-CTX-017 | Une ___ peut être rouge ou verte. C’est un fruit. | pomme |
| T1-VOC-CTX-018 | J’écris un ___ sur mon téléphone et je l’envoie à mon ami. | message |
| T1-VOC-CTX-019 | Mon ___ a deux roues. Je vais à l’école avec. | vélo |
| T1-VOC-CTX-020 | Je porte un ___ bleu. C’est un pantalon. | jean |
| T1-VOC-CTX-021 | J’ai douze ___. | ans |
| T1-VOC-CTX-022 | Une ___ scolaire commence en septembre. | année |
| T1-VOC-CTX-023 | J’écoute de la ___ avec mes écouteurs. | musique |
| T1-VOC-CTX-024 | En été, je porte un ___ parce qu’il fait chaud. | short |
| T1-VOC-CTX-025 | Je porte un ___ blanc à manches courtes. | teeshirt |
| T1-VOC-CTX-027 | Monsieur Dupont donne le cours de français. C’est mon ___. | professeur |
| T1-VOC-CTX-028 | Emma arrive aujourd’hui pour la première fois dans notre classe. Elle est ___. | nouvelle |
| T1-VOC-CTX-029 | Lucas arrive aujourd’hui pour la première fois dans notre classe. Il est ___. | nouveau |
| T1-VOC-CTX-030 | Aujourd’hui, c’est mon ___ jour dans cette école. | premier |
| T1-VOC-CTX-031 | C’est la ___ fois que je viens ici. | première |
| T1-VOC-CTX-032 | Il comprend très vite les exercices difficiles. Il est ___. | intelligent |
| T1-VOC-CTX-033 | Elle comprend très vite les exercices difficiles. Elle est ___. | intelligente |
| T1-VOC-CTX-034 | J’aime le foot et j’aime ___ le basket. | aussi |
| T1-VOC-CTX-038 | Mon école est à 500 mètres de chez moi. Elle n’est pas ___ de ma maison. | loin |
| T1-VOC-CTX-039 | Dépêche-toi ! Le cours commence dans une minute. ___ ! | Vite |

Opmerking:
- 032/033 alleen gebruiken binnen de beperkte scope `On se rappelle ?`; niet in gemengde T1-context waar `malin/maligne` ook actief is.
- 026, 035, 036, 037 en 040 zijn geschrapt/verplaatst wegens ambiguïteit of verkeerde categorie.

### On découvre ! — substantieven

| ID | Prompt | Antwoord |
|---|---|---|
| T1-VOC-CTX-041 | Au ___, on joue avec une raquette et un volant. | badminton |
| T1-VOC-CTX-042 | Je mets une ___ sur ma tête quand il y a du soleil. | casquette |
| T1-VOC-CTX-043 | Le ___ entraîne l’équipe avant le match. | coach |
| T1-VOC-CTX-044 | Le ___ de français commence à neuf heures. | cours |
| T1-VOC-CTX-045 | Le ___ est un sport à vélo. | cyclisme |
| T1-VOC-CTX-046 | J’aime la ___. Je bouge sur de la musique. | danse |
| T1-VOC-CTX-047 | Il fait vingt ___ aujourd’hui. | degrés |
| T1-VOC-CTX-048 | Le dimanche, ils vont à l’___. | église |
| T1-VOC-CTX-049 | Je mets de l’eau dans ma ___ pour aller au sport. | gourde |
| T1-VOC-CTX-050 | Nous travaillons à quatre. Nous sommes un ___. | groupe |
| T1-VOC-CTX-051 | Je regarde l’heure sur l’___ de la classe. | horloge |
| T1-VOC-CTX-052 | Minecraft est un ___. | jeu vidéo |
| T1-VOC-CTX-054 | Je regarde mon visage dans le ___. | miroir |
| T1-VOC-CTX-055 | Au ___, on joue avec une raquette et les murs font partie du jeu. | padel |
| T1-VOC-CTX-056 | Instagram et TikTok sont des ___. | réseaux sociaux |
| T1-VOC-CTX-057 | Je mets mes livres et ma trousse dans mon ___. | sac à dos |
| T1-VOC-CTX-058 | Nous faisons de la gym dans la ___ de sport. | salle |
| T1-VOC-CTX-059 | Au ___, on joue avec les mains et il y a un filet au milieu. | volley |

Opmerking:
- `loisir` krijgt geen vrije contextvraag; `hobby` is te verdedigbaar als alternatief.

### On découvre ! — werkwoorden/werkwoordgroepen als vocabulaire

| ID | Prompt | Antwoord |
|---|---|---|
| T1-VOC-CTX-060 | J’aime ___ : je prépare des pâtes et des pizzas. | cuisiner |
| T1-VOC-CTX-061 | Avec un crayon, j’aime ___ des personnages. | dessiner |
| T1-VOC-CTX-062 | Avec mes écouteurs, j’aime ___. | écouter de la musique |
| T1-VOC-CTX-063 | Avec mon téléphone, j’aime ___ à mes amis. | envoyer des messages |
| T1-VOC-CTX-064 | Le samedi, j’aime ___ avec ma mère pour acheter des vêtements. | faire du shopping |
| T1-VOC-CTX-065 | J’ai un piano à la maison et j’aime ___. | jouer du piano |
| T1-VOC-CTX-066 | J’aime ___ des livres et des BD. | lire |
| T1-VOC-CTX-067 | Pour aller à l’école, je préfère ___ : je vais à pied. | marcher |
| T1-VOC-CTX-068 | À la piscine, j’aime ___. | nager |
| T1-VOC-CTX-069 | Avec mes amis, j’aime ___ de l’école et du sport. | parler |
| T1-VOC-CTX-070 | Au cinéma, j’aime ___. | regarder des films |
| T1-VOC-CTX-071 | Après l’école, j’aime ___ avec mes amis sans rien faire de spécial. | trainer |

Vaste regel:
- bij vaste werkwoordgroepen moet het volledige vocab-item als antwoord gevraagd worden.

### On découvre ! — adjectieven/mots invariables

| ID | Prompt | Antwoord |
|---|---|---|
| T1-VOC-CTX-072 | Lucas raconte toujours des blagues. Il est très ___. | drôle |
| T1-VOC-CTX-073 | Emma raconte toujours des blagues. Elle est très ___. | drôle |
| T1-VOC-CTX-074 | Monsieur Martin donne beaucoup de punitions et accepte très peu de choses. Il est ___. | sévère |
| T1-VOC-CTX-075 | Madame Martin donne beaucoup de punitions et accepte très peu de choses. Elle est ___. | sévère |
| T1-VOC-CTX-076 | Lucas ne plaisante pas pendant le travail et fait toujours son travail avec attention. Il est ___. | sérieux |
| T1-VOC-CTX-077 | Emma ne plaisante pas pendant le travail et fait toujours son travail avec attention. Elle est ___. | sérieuse |
| T1-VOC-CTX-078 | Lucas fait du foot, du vélo et du badminton. Il est très ___. | sportif |
| T1-VOC-CTX-079 | Emma fait du foot, du vélo et du badminton. Elle est très ___. | sportive |
| T1-VOC-CTX-080 | Emma parle facilement avec tout le monde et aime rencontrer de nouvelles personnes. Elle est ___. | sociable |
| T1-VOC-CTX-081 | Dépêche-toi ! Marche ___, le cours commence ! | vite |

Geen vrije contextvragen voor:
- génial(e)
- gentil(le)
- malin/maligne
wegens te sterke overlap met andere adjectieven.

---

# 2. Expressions / Actes de parole

Eigen oefenlogica: hier mag een Nederlandse betekenis of situationele cue zichtbaar zijn.

| ID | Prompt | Verwacht antwoord |
|---|---|---|
| T1-EXP-001 | Je ontmoet iemand. Zeg: Hallo. | Bonjour. |
| T1-EXP-002 | Informeel: Hoi! | Salut ! |
| T1-EXP-003 | — Ça va ? — ___  Betekenis: Het gaat goed. | Ça va bien. |
| T1-EXP-004 | Vraag: Hoe gaat het? | Ça va ? |
| T1-EXP-005 | Zeg: Dat komt goed uit. | Ça tombe bien. |
| T1-EXP-006 | Zeg: En jij? | Et toi ? |
| T1-EXP-007 | Vraag iemands voornaam: Hoe heet je? | Tu t’appelles comment ? |
| T1-EXP-008 | — Tu t’appelles comment ? — ___  Je heet Emma. | Je m’appelle Emma. |
| T1-EXP-009 | Vraag naar de leeftijd: Hoe oud ben je? | Tu as quel âge ? |
| T1-EXP-010 | — Tu as quel âge ? — ___  Ik ben twaalf jaar. | J’ai douze ans. |
| T1-EXP-011 | Vraag naar de woonplaats: Waar woon je? | Tu habites où ? |
| T1-EXP-012 | — Tu habites où ? — ___  Ik woon in Turnhout. | J’habite à Turnhout. |
| T1-EXP-013 | Vraag naar hobby’s: Wat zijn je hobby’s? | Quels sont tes hobbys ? |
| T1-EXP-014 | Zeg: Ik hou van muziek. | J’aime la musique. |
| T1-EXP-015 | Stel Lucas voor: Hij heet Lucas. | Il s’appelle Lucas. |
| T1-EXP-016 | Stel Emma voor: Zij heet Emma. | Elle s’appelle Emma. |
| T1-EXP-017 | Vertel over Lucas: Hij is twaalf jaar. | Il a douze ans. |
| T1-EXP-018 | Vertel over Emma: Zij woont in Turnhout. | Elle habite à Turnhout. |
| T1-EXP-019 | Vertel over Lucas: Hij houdt van voetbal. | Il aime le foot. |
| T1-EXP-020 | Vertel over Emma: Zij houdt van muziek. | Elle aime la musique. |
| T1-EXP-021 | Je quitte l’école et je dis au revoir à mon professeur. Betekenis: Fijne dag! | Bonne journée ! |
| T1-EXP-022 | Betekenis: Het is tijd om ... | Il est l’heure de ... |

Progressie:
- Apprendre: expliciete betekenis/cue.
- S'entraîner: meer situationeel.
- Se tester: zo weinig mogelijk steun.

---

# 3. Atelier Verbes

## 3.1 Officiële werkwoorddoelen

### Regelmatige -ER-werkwoorden
1. adorer
2. aider
3. aimer
4. chanter
5. chercher
6. commencer
7. cuisiner
8. danser
9. dessiner
10. détester
11. donner
12. écouter
13. habiter
14. jouer
15. marcher
16. nager
17. parler
18. raconter
19. regarder
20. rester
21. trainer
22. travailler

### Onregelmatig
23. être
24. avoir

Geen andere vocabulairewerkwoorden automatisch toevoegen aan deze conjugatiemodule.

### Spelling
Expliciete correcte vormen uit de brondata blijven leidend:
- commencer → nous commençons
- nager → nous nageons

Voor `trainer`:
- cursusvormen blijven geldig: trainer, traine, trainons, trainez, trainent
- accepteer daarnaast traditionele spelling als accepted answer:
  - traîner
  - traîne
  - traînons
  - traînez
  - traînent

---

## 3.2 Oefenvormen

### Conjuguer / Vervoegen
Dynamische bestaande vorm:
`nous + habiter → nous habitons`

### Dans une phrase / In een zin
Infinitief blijft zichtbaar:
`Nous ___ à Turnhout. (habiter) → habitons`

### Niveauverdeling
- Niveau 1: expliciet persoonlijk voornaamwoord
- Niveau 2: naam/concreet onderwerp
- Niveau 3: samengesteld onderwerp

Apprendre-uitleg niveau 3:
- Lina et moi = nous
- Emma et Sarah = elles
- Lucas et Emma = ils
- Lucas et toi = vous

---

## 3.3 -ER in context

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T1-VERB-CTX-001 | 1 | J’___ la musique. (adorer) | adore |
| T1-VERB-CTX-002 | 2 | Emma ___ les jeux vidéo. (adorer) | adore |
| T1-VERB-CTX-003 | 3 | Lucas et Emma ___ le badminton. (adorer) | adorent |
| T1-VERB-CTX-004 | 1 | Tu ___ ton frère. (aider) | aides |
| T1-VERB-CTX-005 | 2 | Monsieur Martin ___ un élève. (aider) | aide |
| T1-VERB-CTX-006 | 3 | Lina et moi ___ notre professeur. (aider) | aidons |
| T1-VERB-CTX-007 | 1 | Nous ___ le sport. (aimer) | aimons |
| T1-VERB-CTX-008 | 2 | Lucas ___ le foot. (aimer) | aime |
| T1-VERB-CTX-009 | 3 | Emma et Sarah ___ la musique. (aimer) | aiment |
| T1-VERB-CTX-010 | 1 | Je ___ souvent en classe. (chanter) | chante |
| T1-VERB-CTX-011 | 2 | Olivia ___ en classe. (chanter) | chante |
| T1-VERB-CTX-012 | 3 | Mes amis et moi ___ en classe. (chanter) | chantons |
| T1-VERB-CTX-013 | 1 | Vous ___ votre sac à dos ? (chercher) | cherchez |
| T1-VERB-CTX-014 | 2 | Hugo ___ sa gourde. (chercher) | cherche |
| T1-VERB-CTX-015 | 3 | Emma et Lucas ___ leur professeur. (chercher) | cherchent |
| T1-VERB-CTX-016 | 1 | Nous ___ le cours à neuf heures. (commencer) | commençons |
| T1-VERB-CTX-017 | 2 | Le cours de français ___ à huit heures. (commencer) | commence |
| T1-VERB-CTX-018 | 3 | Les cours ___ à huit heures trente. (commencer) | commencent |
| T1-VERB-CTX-019 | 1 | Tu ___ souvent avec ton père ? (cuisiner) | cuisines |
| T1-VERB-CTX-020 | 2 | Ma sœur ___ des pâtes. (cuisiner) | cuisine |
| T1-VERB-CTX-021 | 3 | Mon frère et moi ___ ensemble. (cuisiner) | cuisinons |
| T1-VERB-CTX-022 | 1 | Elles ___ dans la salle de danse. (danser) | dansent |
| T1-VERB-CTX-023 | 2 | Chloé ___ très bien. (danser) | danse |
| T1-VERB-CTX-024 | 3 | Emma et Sarah ___ ensemble. (danser) | dansent |
| T1-VERB-CTX-025 | 1 | Je ___ un chat. (dessiner) | dessine |
| T1-VERB-CTX-026 | 2 | Lucas ___ son professeur. (dessiner) | dessine |
| T1-VERB-CTX-027 | 3 | Lina et moi ___ des chats. (dessiner) | dessinons |
| T1-VERB-CTX-028 | 1 | Nous ___ la gym. (détester) | détestons |
| T1-VERB-CTX-029 | 2 | Emma ___ le foot. (détester) | déteste |
| T1-VERB-CTX-030 | 3 | Mes amis ___ les cours difficiles. (détester) | détestent |
| T1-VERB-CTX-031 | 1 | Tu ___ une pomme à ton frère. (donner) | donnes |
| T1-VERB-CTX-032 | 2 | Le professeur ___ un exercice aux élèves. (donner) | donne |
| T1-VERB-CTX-033 | 3 | Emma et moi ___ une pomme à Lucas. (donner) | donnons |
| T1-VERB-CTX-034 | 1 | Vous ___ souvent de la musique ? (écouter) | écoutez |
| T1-VERB-CTX-035 | 2 | Lucas ___ de la musique. (écouter) | écoute |
| T1-VERB-CTX-036 | 3 | Mes copines ___ de la musique dans leur chambre. (écouter) | écoutent |
| T1-VERB-CTX-037 | 1 | J’___ à Turnhout. (habiter) | habite |
| T1-VERB-CTX-038 | 2 | Sarah ___ à Bruxelles. (habiter) | habite |
| T1-VERB-CTX-039 | 3 | Lina et moi ___ près de l’école. (habiter) | habitons |
| T1-VERB-CTX-040 | 1 | Tu ___ au basket après l’école. (jouer) | joues |
| T1-VERB-CTX-041 | 2 | Lucas ___ au foot avec ses amis. (jouer) | joue |
| T1-VERB-CTX-042 | 3 | Emma et Sarah ___ au badminton. (jouer) | jouent |
| T1-VERB-CTX-043 | 1 | Nous ___ dans le parc. (marcher) | marchons |
| T1-VERB-CTX-044 | 2 | Mon professeur ___ jusqu’à l’école. (marcher) | marche |
| T1-VERB-CTX-045 | 3 | Lucas et moi ___ ensemble. (marcher) | marchons |
| T1-VERB-CTX-046 | 1 | Nous ___ à la piscine. (nager) | nageons |
| T1-VERB-CTX-047 | 2 | Emma ___ très bien. (nager) | nage |
| T1-VERB-CTX-048 | 3 | Mes amis ___ le mercredi. (nager) | nagent |
| T1-VERB-CTX-049 | 1 | Je ___ français avec mon professeur. (parler) | parle |
| T1-VERB-CTX-050 | 2 | Lucas ___ avec ses amis. (parler) | parle |
| T1-VERB-CTX-051 | 3 | Emma et moi ___ de nos hobbies. (parler) | parlons |
| T1-VERB-CTX-052 | 1 | Tu ___ une histoire à ton frère. (raconter) | racontes |
| T1-VERB-CTX-053 | 2 | Le professeur ___ une histoire. (raconter) | raconte |
| T1-VERB-CTX-054 | 3 | Mes grands-parents ___ beaucoup d’histoires. (raconter) | racontent |
| T1-VERB-CTX-055 | 1 | Vous ___ souvent des films ? (regarder) | regardez |
| T1-VERB-CTX-056 | 2 | Sarah ___ un film sur son téléphone. (regarder) | regarde |
| T1-VERB-CTX-057 | 3 | Lucas et Emma ___ des films ensemble. (regarder) | regardent |
| T1-VERB-CTX-058 | 1 | Je ___ à la maison aujourd’hui. (rester) | reste |
| T1-VERB-CTX-059 | 2 | Mon frère ___ avec ses amis. (rester) | reste |
| T1-VERB-CTX-060 | 3 | Emma et moi ___ après le cours. (rester) | restons |
| T1-VERB-CTX-061 | 1 | Tu ___ souvent avec tes amis après l’école. (trainer) | traines |
| T1-VERB-CTX-062 | 2 | Lucas ___ dans le parc avec ses copains. (trainer) | traine |
| T1-VERB-CTX-063 | 3 | Mes amis ___ ensemble après les cours. (trainer) | trainent |
| T1-VERB-CTX-064 | 1 | Vous ___ beaucoup à l’école. (travailler) | travaillez |
| T1-VERB-CTX-065 | 2 | Emma ___ bien en classe. (travailler) | travaille |
| T1-VERB-CTX-066 | 3 | Mon frère et moi ___ ensemble. (travailler) | travaillons |

Selectie-algoritme moet balanceren over:
`je`, `tu`, `il/elle/on`, `nous`, `vous`, `ils/elles`.

---

## 3.4 Être

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T1-VERB-CTX-067 | 1 | Je ___ en 1A. (être) | suis |
| T1-VERB-CTX-068 | 1 | Tu ___ dans ma classe. (être) | es |
| T1-VERB-CTX-069 | 1 | Il ___ très sportif. (être) | est |
| T1-VERB-CTX-070 | 1 | Elle ___ très sympa. (être) | est |
| T1-VERB-CTX-071 | 1 | On ___ en Belgique. (être) | est |
| T1-VERB-CTX-072 | 1 | Nous ___ dans la salle de sport. (être) | sommes |
| T1-VERB-CTX-073 | 1 | Vous ___ le professeur de français ? (être) | êtes |
| T1-VERB-CTX-074 | 1 | Ils ___ dans ma classe. (être) | sont |
| T1-VERB-CTX-075 | 1 | Elles ___ très sportives. (être) | sont |
| T1-VERB-CTX-076 | 2 | Lucas ___ nouveau dans notre école. (être) | est |
| T1-VERB-CTX-077 | 2 | Emma ___ en première année. (être) | est |
| T1-VERB-CTX-078 | 2 | Mes parents ___ à la maison. (être) | sont |
| T1-VERB-CTX-079 | 3 | Mon frère et moi ___ dans la même école. (être) | sommes |
| T1-VERB-CTX-080 | 3 | Emma et Sarah ___ dans le même groupe. (être) | sont |
| T1-VERB-CTX-081 | 3 | Monsieur, vous ___ mon nouveau professeur ? (être) | êtes |

## 3.5 Avoir

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T1-VERB-CTX-082 | 1 | J’___ douze ans. (avoir) | ai |
| T1-VERB-CTX-083 | 1 | Tu ___ un frère ? (avoir) | as |
| T1-VERB-CTX-084 | 1 | Il ___ un chien. (avoir) | a |
| T1-VERB-CTX-085 | 1 | Elle ___ une sœur. (avoir) | a |
| T1-VERB-CTX-086 | 1 | On ___ un cours de français aujourd’hui. (avoir) | a |
| T1-VERB-CTX-087 | 1 | Nous ___ deux chats. (avoir) | avons |
| T1-VERB-CTX-088 | 1 | Vous ___ quel âge ? (avoir) | avez |
| T1-VERB-CTX-089 | 1 | Ils ___ un coach très sympa. (avoir) | ont |
| T1-VERB-CTX-090 | 1 | Elles ___ treize ans. (avoir) | ont |
| T1-VERB-CTX-091 | 2 | Lucas ___ un vélo rouge. (avoir) | a |
| T1-VERB-CTX-092 | 2 | Emma ___ beaucoup d’amis. (avoir) | a |
| T1-VERB-CTX-093 | 2 | Mes amis ___ un match ce soir. (avoir) | ont |
| T1-VERB-CTX-094 | 3 | Lucas et moi ___ le même professeur. (avoir) | avons |
| T1-VERB-CTX-095 | 3 | Emma et Sarah ___ douze ans. (avoir) | ont |
| T1-VERB-CTX-096 | 3 | Madame, vous ___ un chien ? (avoir) | avez |

## 3.6 Être ou avoir ?

| ID | Vraag | Antwoord |
|---|---|---|
| T1-VERB-MIX-001 | J’___ douze ans. | ai |
| T1-VERB-MIX-002 | Je ___ en première année. | suis |
| T1-VERB-MIX-003 | Tu ___ un frère ? | as |
| T1-VERB-MIX-004 | Tu ___ nouveau dans cette école ? | es |
| T1-VERB-MIX-005 | Mon père ___ professeur. | est |
| T1-VERB-MIX-006 | Emma ___ treize ans. | a |
| T1-VERB-MIX-007 | Nous ___ en Belgique. | sommes |
| T1-VERB-MIX-008 | Nous ___ un cours de français. | avons |
| T1-VERB-MIX-009 | Vous ___ combien à la maison ? | êtes |
| T1-VERB-MIX-010 | Vous ___ un chat ? | avez |
| T1-VERB-MIX-011 | Lucas et Emma ___ dans ma classe. | sont |
| T1-VERB-MIX-012 | Lucas et Emma ___ un chien. | ont |
| T1-VERB-MIX-013 | Elle ___ très sportive. | est |
| T1-VERB-MIX-014 | Elle ___ deux sœurs. | a |
| T1-VERB-MIX-015 | Mes amis ___ douze ans. | ont |
| T1-VERB-MIX-016 | Mes amis ___ très sympas. | sont |

Microfeedback in Apprendre:
- leeftijd → avoir
- locatie/toestand/identiteit → être

## 3.7 Sujet → pronom personnel

Prompt:
**Remplace par le bon pronom personnel.**
*Vervang door het juiste persoonlijk voornaamwoord.*

| ID | Niveau | Sujet | Antwoord |
|---|---:|---|---|
| T1-VERB-SUBJ-001 | 1 | Moi | je |
| T1-VERB-SUBJ-002 | 1 | Toi | tu |
| T1-VERB-SUBJ-003 | 1 | Lucas | il |
| T1-VERB-SUBJ-004 | 1 | Emma | elle |
| T1-VERB-SUBJ-005 | 1 | Mon frère | il |
| T1-VERB-SUBJ-006 | 1 | Ma sœur | elle |
| T1-VERB-SUBJ-007 | 1 | Le garçon | il |
| T1-VERB-SUBJ-008 | 1 | La fille | elle |
| T1-VERB-SUBJ-009 | 2 | Lucas et Hugo | ils |
| T1-VERB-SUBJ-010 | 2 | Emma et Sarah | elles |
| T1-VERB-SUBJ-011 | 2 | Lucas et Emma | ils |
| T1-VERB-SUBJ-012 | 2 | Mon frère et ma sœur | ils |
| T1-VERB-SUBJ-013 | 2 | Mes copines | elles |
| T1-VERB-SUBJ-014 | 2 | Les garçons | ils |
| T1-VERB-SUBJ-015 | 2 | Les filles | elles |
| T1-VERB-SUBJ-016 | 2 | Emma, Sarah et Lucas | ils |
| T1-VERB-SUBJ-017 | 3 | Lucas et moi | nous |
| T1-VERB-SUBJ-018 | 3 | Emma et moi | nous |
| T1-VERB-SUBJ-019 | 3 | Mes amis et moi | nous |
| T1-VERB-SUBJ-020 | 3 | Toi et Lucas | vous |
| T1-VERB-SUBJ-021 | 3 | Toi et Emma | vous |
| T1-VERB-SUBJ-022 | 3 | Ton frère et toi | vous |
| T1-VERB-SUBJ-023 | 2 | Lucas et Emma habitent à Turnhout. → ___ habitent à Turnhout. | Ils |
| T1-VERB-SUBJ-024 | 3 | Lucas et Emma, ___ habitez à Turnhout ? | vous |

`on` niet geforceerd in deze bank; wordt in gewone vervoeging geoefend.

---

# 4. Atelier Grammaire — L’article défini et indéfini

## 4.1 4A — Vorm kiezen

### Article indéfini

| ID | Vraag | Antwoord |
|---|---|---|
| T1-GRAM-IND-001 | J’ai ___ frère. | un |
| T1-GRAM-IND-002 | J’ai ___ sœur. | une |
| T1-GRAM-IND-003 | Nous avons ___ chien. | un |
| T1-GRAM-IND-004 | Elle a ___ gourde rouge. | une |
| T1-GRAM-IND-005 | Il a ___ vélo. | un |
| T1-GRAM-IND-006 | Emma porte ___ casquette. | une |
| T1-GRAM-IND-007 | J’ai ___ amis dans ma classe. | des |
| T1-GRAM-IND-008 | Elle regarde ___ films. | des |
| T1-GRAM-IND-009 | Nous avons ___ jeux vidéo. | des |
| T1-GRAM-IND-010 | Il envoie ___ messages. | des |

### Article défini

| ID | Vraag | Antwoord |
|---|---|---|
| T1-GRAM-DEF-001 | ___ foot est mon sport préféré. | Le |
| T1-GRAM-DEF-002 | ___ musique est super. | La |
| T1-GRAM-DEF-003 | ___ école est près de chez moi. | L’ |
| T1-GRAM-DEF-004 | ___ horloge est dans la classe. | L’ |
| T1-GRAM-DEF-005 | ___ professeur est sympa. | Le |
| T1-GRAM-DEF-006 | ___ classe commence à huit heures. | La |
| T1-GRAM-DEF-007 | ___ élèves sont dans la classe. | Les |
| T1-GRAM-DEF-008 | ___ garçons jouent au foot. | Les |
| T1-GRAM-DEF-009 | ___ filles dansent. | Les |
| T1-GRAM-DEF-010 | ___ amis de Lucas sont sportifs. | Les |

### Enkelvoud ↔ meervoud

| ID | Vraag | Antwoord |
|---|---|---|
| T1-GRAM-TRANS-001 | un garçon → ___ garçons | des |
| T1-GRAM-TRANS-002 | une fille → ___ filles | des |
| T1-GRAM-TRANS-003 | le garçon → ___ garçons | les |
| T1-GRAM-TRANS-004 | la fille → ___ filles | les |
| T1-GRAM-TRANS-005 | des messages → ___ message | un |
| T1-GRAM-TRANS-006 | les casquettes → ___ casquette | la |

Apprendre:
- korte regel en microfeedback
- `l’` uitleggen als vorm vóór klinker/stomme h, niet als apart geslacht

---

## 4.2 4B — Défini ou indéfini in context

Voorkeur voor paired context:
eerste vermelding → onbepaald;
herverwijzing → bepaald.

| ID | Vraag | Antwoorden |
|---|---|---|
| T1-GRAM-MIX-001 | J’ai ___ chien. ___ chien s’appelle Max. | un · Le |
| T1-GRAM-MIX-002 | Emma a ___ sœur. ___ sœur a treize ans. | une · La |
| T1-GRAM-MIX-003 | Nous avons ___ professeur de français. ___ professeur est très sympa. | un · Le |
| T1-GRAM-MIX-004 | Lucas a ___ casquette. ___ casquette est rouge. | une · La |
| T1-GRAM-MIX-005 | J’ai ___ amis à Bruxelles. ___ amis habitent près de l’école. | des · Les |
| T1-GRAM-MIX-006 | Il a ___ jeux vidéo. ___ jeux vidéo sont dans sa chambre. | des · Les |
| T1-GRAM-MIX-007 | Sarah a ___ vélo. ___ vélo est bleu. | un · Le |
| T1-GRAM-MIX-008 | Dans la classe, il y a ___ horloge. ___ horloge est au mur. | une · L’ |
| T1-GRAM-MIX-009 | Dans mon sac, il y a ___ livre et ___ gourde. ___ gourde est rouge. | un · une · La |
| T1-GRAM-MIX-010 | Lucas a ___ frère et ___ sœur. ___ frère a quinze ans. | un · une · Le |
| T1-GRAM-MIX-011 | Dans notre école, il y a ___ salle de sport. ___ salle est très grande. | une · La |
| T1-GRAM-MIX-012 | J’ai ___ amis à Turnhout. ___ amis sont dans ma classe. | des · Les |
| T1-GRAM-MIX-013 | Emma reçoit ___ message. ___ message vient de sa copine. | un · Le |
| T1-GRAM-MIX-014 | Il y a ___ élèves devant l’école. ___ élèves attendent leur professeur. | des · Les |

Aanvullende items mogen worden toegevoegd zolang ze exact hetzelfde eenduidige patroon volgen.
Losse zinnen waarvan `un` én `le` afhankelijk van discourse beide mogelijk zijn, niet gebruiken.

---

## 4.3 4C — aimer / adorer / détester

Regel:
- + substantief → article défini
- + werkwoord → infinitief

### Substantief

| ID | Vraag | Antwoord |
|---|---|---|
| T1-GRAM-AIMER-001 | J’aime ___ foot. | le |
| T1-GRAM-AIMER-002 | Emma adore ___ musique. | la |
| T1-GRAM-AIMER-003 | Tu aimes ___ basket ? | le |
| T1-GRAM-AIMER-004 | Nous adorons ___ badminton. | le |
| T1-GRAM-AIMER-005 | Lucas aime ___ cyclisme. | le |
| T1-GRAM-AIMER-006 | Elle adore ___ danse. | la |
| T1-GRAM-AIMER-007 | Vous aimez ___ jeux vidéo ? | les |
| T1-GRAM-AIMER-008 | Mes amis adorent ___ réseaux sociaux. | les |
| T1-GRAM-AIMER-009 | Je déteste ___ volley. | le |
| T1-GRAM-AIMER-010 | Sarah déteste ___ gymnastique. | la |
| T1-GRAM-AIMER-011 | Ils aiment ___ padel. | le |

### Substantief tegenover infinitief

| ID | Vraag | Antwoord |
|---|---|---|
| T1-GRAM-AIMER-013 | J’aime ___ basket. | le |
| T1-GRAM-AIMER-014 | J’aime ___ au basket. | jouer |
| T1-GRAM-AIMER-015 | Emma adore ___ musique. | la |
| T1-GRAM-AIMER-016 | Emma adore ___ de la musique. | écouter |
| T1-GRAM-AIMER-017 | Lucas aime ___ danse. | la |
| T1-GRAM-AIMER-018 | Lucas aime ___ dans la salle de danse. | danser |
| T1-GRAM-AIMER-019 | Nous aimons ___ films. | les |
| T1-GRAM-AIMER-020 | Nous aimons ___ des films. | regarder |
| T1-GRAM-AIMER-021 | Tu adores ___ cuisine. | la |
| T1-GRAM-AIMER-022 | Tu adores ___ : tu prépares des pâtes et des pizzas. | cuisiner |
| T1-GRAM-AIMER-023 | Elles aiment ___ : elles vont à la piscine. | nager |

### Gemengd

| ID | Vraag | Antwoord |
|---|---|---|
| T1-GRAM-AIMER-025 | J’adore ___ musique. | la |
| T1-GRAM-AIMER-026 | J’adore ___ de la musique. | écouter |
| T1-GRAM-AIMER-027 | Ils aiment ___ jeux vidéo. | les |
| T1-GRAM-AIMER-028 | Ils aiment ___ à des jeux vidéo. | jouer |
| T1-GRAM-AIMER-029 | Emma déteste ___ foot. | le |
| T1-GRAM-AIMER-030 | Emma déteste ___ au foot. | jouer |

Microfeedback:
- `aimer + substantif → article défini`
- `aimer + verbe → infinitif`

---

## 4.4 4D — Alles gemengd

### Zinnen

| ID | Vraag | Antwoorden |
|---|---|---|
| T1-GRAM-ALL-001 | J’ai ___ chien. ___ chien s’appelle Max. | un · Le |
| T1-GRAM-ALL-002 | Emma porte ___ casquette rouge. ___ casquette est nouvelle. | une · La |
| T1-GRAM-ALL-003 | Dans la classe, il y a ___ horloge. ___ horloge indique neuf heures. | une · L’ |
| T1-GRAM-ALL-004 | Nous avons ___ professeur de français. ___ professeur est très sympa. | un · Le |
| T1-GRAM-ALL-005 | Il y a ___ élèves devant l’école. ___ élèves attendent leur professeur. | des · Les |
| T1-GRAM-ALL-006 | Lucas aime ___ foot mais il adore ___ basket. | le · le |
| T1-GRAM-ALL-007 | Sarah adore ___ musique et elle aime ___ des films. | la · regarder |
| T1-GRAM-ALL-008 | Mes amis aiment ___ jeux vidéo et adorent ___ au badminton. | les · jouer |
| T1-GRAM-ALL-009 | Je déteste ___ gymnastique mais j’aime ___ à pied. | la · marcher |
| T1-GRAM-ALL-010 | Nous avons ___ jeux vidéo. Nous adorons ___ jeux vidéo. | des · les |
| T1-GRAM-ALL-011 | Hugo a ___ vélo rouge. ___ vélo est devant l’école. | un · Le |
| T1-GRAM-ALL-012 | Emma a ___ frère et ___ sœur. Elle adore ___ au basket avec eux. | un · une · jouer |

### Mini-contexten

| ID | Vraag | Antwoorden |
|---|---|---|
| T1-GRAM-ALL-013 | — Tu as un animal ? — Oui, j’ai ___ chien. ___ chien s’appelle Oscar. | un · Le |
| T1-GRAM-ALL-014 | — Quels sont tes hobbies ? — J’aime ___ musique et j’adore ___ au basket. | la · jouer |
| T1-GRAM-ALL-015 | Dans mon sac à dos, j’ai ___ gourde et ___ teeshirt. ___ gourde est bleue. | une · un · La |
| T1-GRAM-ALL-016 | Lucas a ___ jeux vidéo dans sa chambre. Il adore ___ jeux vidéo et il aime aussi ___ des films. | des · les · regarder |
| T1-GRAM-ALL-017 | Dans notre école, il y a ___ salle de sport. ___ salle est grande. Les élèves aiment ___ sport. | une · La · le |
| T1-GRAM-ALL-018 | Emma a ___ casquette rouge et ___ vélo bleu. Elle aime ___ cyclisme. | une · un · le |

### Fout herkennen/corrigeren
Gebruik alleen ondubbelzinnig fout Frans.

| ID | Foute zin | Correctie |
|---|---|---|
| T1-GRAM-CORR-001 | J’aime un foot. | J’aime le foot. |
| T1-GRAM-CORR-005 | Nous adorons des jeux vidéo. | Nous adorons les jeux vidéo. |
| T1-GRAM-CORR-006 | J’aime le jouer au basket. | J’aime jouer au basket. |

Geen foutcorrectie gebruiken wanneer de “foute” zin in een andere context grammaticaal mogelijk is.

---

# 5. Révision du trajet

Aparte tegel:
**Révision du trajet**
*Alles door elkaar*

Doel:
vocabulaire + expressions + werkwoorden + grammatica integreren.

## 5.1 Volledige zinnen NL → FR

| ID | Nederlands | Correct Frans |
|---|---|---|
| T1-REV-001 | Ik heet Emma en ik ben twaalf jaar. | Je m’appelle Emma et j’ai douze ans. |
| T1-REV-002 | Ik woon in Turnhout en ik hou van muziek. | J’habite à Turnhout et j’aime la musique. |
| T1-REV-003 | Lucas houdt van voetbal en videogames. | Lucas aime le foot et les jeux vidéo. |
| T1-REV-004 | Wij hebben een hond en twee katten. | Nous avons un chien et deux chats. |
| T1-REV-005 | Emma heeft een rugzak en een drinkfles. | Emma a un sac à dos et une gourde. |
| T1-REV-006 | Lucas en Emma spelen basketbal. | Lucas et Emma jouent au basket. |
| T1-REV-007 | Sarah luistert naar muziek. | Sarah écoute de la musique. |
| T1-REV-008 | Mijn broer en ik wonen in Turnhout. | Mon frère et moi habitons à Turnhout. |
| T1-REV-009 | De meisjes dansen. | Les filles dansent. |
| T1-REV-010 | Ik hou van tekenen. | J’aime dessiner. |
| T1-REV-011 | Emma haat voetbal. | Emma déteste le foot. |
| T1-REV-012 | Ik heb een hond. De hond heet Max. | J’ai un chien. Le chien s’appelle Max. |
| T1-REV-013 | Lucas heeft videogames. Hij houdt van videogames. | Lucas a des jeux vidéo. Il aime les jeux vidéo. |
| T1-REV-014 | Ik heb een fiets. De fiets is nieuw. | J’ai un vélo. Le vélo est nouveau. |
| T1-REV-015 | Emma heeft een pet. De pet is nieuw. | Emma a une casquette. La casquette est nouvelle. |

## 5.2 Gemengde invulzinnen

| ID | Vraag | Antwoord(en) |
|---|---|---|
| T1-REV-016 | J’___ douze ans et j’___ à Turnhout. (avoir – habiter) | ai · habite |
| T1-REV-017 | Nous ___ le sport et nous ___ au badminton. (aimer – jouer) | aimons · jouons |
| T1-REV-018 | Emma a ___ casquette. ___ casquette est nouvelle. | une · La |
| T1-REV-019 | Lucas a ___ jeux vidéo. Il adore ___ jeux vidéo. | des · les |
| T1-REV-020 | Mon frère et moi ___ un chien. ___ chien s’appelle Max. (avoir) | avons · Le |
| T1-REV-021 | Emma et Sarah ___ de la musique. (écouter) | écoutent |
| T1-REV-022 | Vous ___ dans ma classe et vous ___ douze ans. (être – avoir) | êtes · avez |
| T1-REV-023 | Dans la classe, il y a ___ horloge. ___ horloge est nouvelle. | une · L’ |
| T1-REV-024 | Lucas ___ le foot et il aime ___ au basket. (adorer) | adore · jouer |
| T1-REV-025 | Les filles ___ très sportives et elles ___ le volley. (être – aimer) | sont · aiment |

## 5.3 Mini-dialogen / korte teksten

### T1-REV-026 — Se présenter
Bonjour ! Je m’appelle Lina.  
J’___ douze ans.  
J’___ à Turnhout.  
J’aime ___ musique et j’adore ___ au badminton.

Antwoorden:
`ai` · `habite` · `la` · `jouer`

### T1-REV-027 — Présenter quelqu’un
Voici Lucas.  
Il ___ douze ans.  
Il ___ à Bruxelles.  
Il ___ le foot et il regarde ___ films.

Antwoorden:
`a` · `habite` · `aime` · `des`

### T1-REV-028 — Les affaires d’Emma
Emma a ___ sac à dos et ___ gourde.  
___ sac à dos est nouveau.  
___ gourde est dans le sac.

Antwoorden:
`un` · `une` · `Le` · `La`

### T1-REV-029 — Les hobbies
Lucas et Emma ___ à Turnhout.  
Ils ___ le basket et ils ___ au badminton.

Antwoorden:
`habitent` · `aiment` · `jouent`

### T1-REV-030 — Petit dialogue
— Salut ! Tu t’appelles comment ?  
— Je m’appelle Hugo.  
— Tu ___ quel âge ?  
— J’___ douze ans.  
— Tu ___ où ?  
— J’___ à Turnhout.  
— Quels sont tes hobbys ?  
— J’aime ___ foot et j’adore ___ des films.

Antwoorden:
`as` · `ai` · `habites` · `habite` · `le` · `regarder`

---

# 6. UI-principes voor deze content

Keep it simple.

Maximaal twee hoofdvormen per contenttype:
- Vocabulaire:
  - Traduire / Vertalen
  - En contexte / In een zin
- Verbes:
  - Conjuguer / Vervoegen
  - Dans une phrase / In een zin

Onderwerp-herkenning is een moeilijkheidslaag binnen de werkwoordmodule, geen extra grote hoofdnavigatie.

Subtiele, consistente visuele codering:
- vertalen: neutraal/blauw
- context: zacht groen
- conjugatie: zacht geel
- grammatica: zacht paars
- test/revision: donkerder/neutraal

Geen felle volledige kleurvlakken; liever kleine badge/icon/top border.
Frans primair, Nederlands klein cursief eronder.

---

# 7. Implementatieregels voor Codex

1. Gebruik deze databank letterlijk als inhoudelijke bron.
2. Genereer niet zelf nieuwe didactische zinnen tenzij expliciet gevraagd.
3. Verander geen bestaande permanente course-item-ID’s.
4. Nieuwe variant-ID’s uit dit document zijn oefenvariant-ID’s, geen mastery-items.
5. Map elke variant op bestaande masterydoelen.
6. Bij meer-gatenvragen:
   - elk gat apart beoordelen;
   - elk gat apart evidence registreren.
7. Bij volledige vertaalzinnen:
   - alleen volledig correct = positieve evidence voor gekoppelde doelen;
   - fout antwoord = geen automatische negatieve evidence voor alle gekoppelde doelen.
8. Respecteer mode-gedrag:
   - Apprendre = begeleid;
   - S'entraîner = zelfstandig;
   - Se tester = feedback op einde.
9. Respecteer de ambiguity rule.
10. Gebruik alleen expliciete accepted answers; geen brede AI/fuzzy correctie.
11. Balanceer werkwoordselectie over de zes canonieke persoonsgroepen.
12. Laat alfabet en sons buiten Mon parcours voor Trajet 1.
13. Voeg geen extra werkwoorden aan de T1-conjugatiemodule toe buiten de 24 officiële doelen.
14. Behoud de bestaande mastery-architectuur en vaste 1036 course-items.

---

# 8. Status Trajet 1

Trajet 1 is inhoudelijk uitgewerkt voor:
- Vocabulaire
- Expressions / Actes de parole
- Atelier Verbes
- Atelier Grammaire
- Révision du trajet

Bewust uitgesloten:
- Alphabet
- Sons / Comment dire ?
- Kiosque als aparte digitale bank

Dit bestand is een checkpoint en kan als basis dienen voor de Codex-implementatie van Trajet 1.


---

# SOURCE CONTENT — TRAJET 2

# Mon parcours — Trajet 2 Content Spec
Version: v1 — zelfstandig uitgewerkt en meermaals gecontroleerd
Bron: Univers français 1 — Trajet 2
Doel: inhoudelijke bron voor Codex. Codex mag de didactische inhoud niet zelf uitbreiden of herschrijven zonder expliciete instructie.

---

# 0. Algemene afspraken uit Trajet 1 blijven gelden

## 0.1 Permanente leeritems
De bestaande permanente course-items en item-ID’s blijven onaangeroerd.

Trajet 2 bevat in de huidige dataset 148 permanente items:
- 83 vocabulaire-/expression-items
- 19 Actes de parole-items
- 15 werkwoorditems
- 21 getalitems (0–20)
- 5 grammar_rule-items
- 5 sound_rule-items

Nieuwe oefenvarianten in dit document zijn **geen nieuwe permanente mastery-items**.

## 0.2 Oefenmodi
- **Apprendre / Leren**
  - begeleid;
  - korte regel/micro-uitleg;
  - na een fout gerichte feedback;
  - geen onafhankelijke mastery-evidence.
- **S’entraîner / Oefenen**
  - zelfstandig;
  - geen antwoord vooraf;
  - hint pas na fout;
  - onafhankelijke evidence.
- **Se tester / Test jezelf**
  - geen hints tijdens de reeks;
  - feedback op het einde;
  - onafhankelijke evidence.

## 0.3 Antwoordregels
- Accenten strikt.
- `'` en `’` gelijkwaardig.
- Beginhoofdletter niet doorslaggevend voor inhoudelijke correctheid.
- Eindpunt niet doorslaggevend.
- Expliciete `accepted_answers` bij echte equivalenten.
- Geen brede fuzzy/AI-correctie.
- Bij een bijna-correct antwoord mag een microhint verschijnen.
- Open contextvragen worden alleen opgenomen als het antwoord voldoende eenduidig is.

## 0.4 Ambiguity rule
Voor elke vrije contextvraag:
> Als een ander actief leerwoord uit dezelfde scope logisch in hetzelfde gat past, herschrijf of schrap de vraag.

Een woord zonder contextoefening is geen probleem.
Een dubbelzinnige contextoefening is wél een probleem.

## 0.5 Mastery
- Oefenvarianten mappen naar bestaande doelen.
- Geen nieuwe permanente doelen.
- Bij meer-gatenvragen: elk gat apart beoordelen/evidence registreren.
- Bij een volledige vertaalzin:
  - volledig correct → positieve evidence voor gekoppelde doelen;
  - niet volledig correct → integratieve vraag fout, maar niet automatisch negatieve evidence voor alle gekoppelde doelen.

---

# 1. Scope Trajet 2

## Wel digitaal oefenen
1. **Atelier Parole — Expliquer les relations familiales / Présenter quelqu’un (2)**
   - Traduire / Vertalen
   - En contexte / In een zin
   - Expressions / Actes de parole
2. **Atelier Verbes — Les verbes en -IR : types partir et finir**
   - Conjuguer / Vervoegen
   - Dans une phrase / In een zin
3. **Chiffres et lettres — De 0 à 20**
   - cijfers ↔ woorden
4. **Atelier Grammaire — La négation**
   - ne ... pas
   - ne ... plus
   - ne ... jamais
   - article après négation
   - uitzondering met être
5. **Révision du trajet**
   - integratieve oefeningen

## Niet als aparte digitale module
- **Kiosque — Panda-stique !!!**
- **Comment dire ? — Le son [e] (télé)**: geen audiomodule
- **Jeu de l’oie**: spelvorm uit boek, geen masterybank
- **Bonne mémoire**: gebruiken als bron/recap, niet als aparte leerbank

De bestaande sound_rule-items worden niet verwijderd; ze worden alleen niet aangeboden in de actieve Mon parcours-oefeninterface.

---

# 2. Vocabulaire Trajet 2

## 2.1 Broninventaris

### On se rappelle ? — substantifs
- l’anglais
- le bébé
- l’enfant
- la famille
- la fille
- le fils
- le français
- la France
- le frère
- le garçon
- la grand-mère
- le grand-père
- le grand-parent
- la maman
- la mère
- le néerlandais
- le nom (de famille)
- l’oncle
- le papa
- le parent
- le père
- la sœur
- la tante

### On se rappelle ? — adjectifs
- chouette
- génial(e)
- grand(e)
- jeune
- nouveau / nouvelle
- petit(e)
- sympa

### On se rappelle ? — expressions
- être en première année
- jouer au foot
- jouer à des jeux vidéo
- pas loin de

### On découvre ! — substantifs
- l’aîné
- l’aînée
- le beau-frère
- le beau-père
- la belle-mère
- la belle-sœur
- la cabine de plage
- le copain
- la copine
- le cousin
- la cousine
- le demi-frère
- la demi-sœur
- le dessin
- l’enfant unique
- la femme
- le Français
- la Française
- les gens
- le jumeau
- la jumelle
- la langue
- la mamie
- le mari
- le papi
- le parasol
- la petite-fille
- le petit-fils
- la planche à voile
- le portugais
- le sud

### On découvre ! — verbes
- divorcer
- cohabiter

### On découvre ! — adjectifs
- adopté(e)
- cool
- délicieux / délicieuse
- divorcé(e)
- français(e)
- marié(e)
- mort(e)
- né(e)
- paresseux / paresseuse
- pratique
- quelques
- seul(e)
- unique

### On découvre ! — expressions
- comme moi
- être (quatre)
- aller au Patro

---

# 3. Vocabulaire — oefenarchitectuur

## 3.1 Traduire / Vertalen
Bestaande directe vertaalvorm blijft behouden.

Regels:
- substantieven met lidwoord;
- adjectiefvormen respecteren;
- echte equivalenten expliciet in `accepted_answers`;
- geen synoniemen automatisch gelijkstellen als de cursus ze als verschillende leeritems aanbiedt.

## 3.2 En contexte / In een zin
- Franse context;
- geen Nederlandse target tussen haakjes;
- context moet het antwoord voldoende afdwingen;
- bij flexie mag de concrete antwoordvorm verschillen van het basisitem;
- de variant mapt terug naar het bestaande item.

## 3.3 Woorden die bewust géén vrije contextoefening krijgen
Vanwege overlap/polysemie of onvoldoende eenduidigheid:
- maman / mère
- papa / père
- grand-mère / mamie
- grand-père / papi
- copain / ami
- copine / amie
- chouette / génial / cool / sympa
- jeune / petit wanneer context onvoldoende onderscheid maakt
- beau-père / belle-mère: familierelatie kan afhankelijk van context zowel stiefouder als schoonouder aanduiden
- beau-frère / belle-sœur: eveneens contextafhankelijk
- unieke taalnamen wanneer de tekstcontext niet naar exact één taal leidt
- unique wanneer `seul(e)` inhoudelijk even goed kan

Deze items blijven gewoon in `Traduire` en/of Actes de parole.

---

# 4. Vocabulaire — En contexte bank

| ID | Prompt | Antwoord | Mapping/opmerking |
|---|---|---|---|
| T2-VOC-CTX-001 | Il a trois mois. C’est encore un ___. | bébé | le bébé |
| T2-VOC-CTX-002 | Mes parents, mon frère, ma sœur et moi : c’est ma ___. | famille | la famille |
| T2-VOC-CTX-003 | Emma est la ___ de monsieur et madame Martin. | fille | la fille |
| T2-VOC-CTX-004 | Lucas est le ___ de monsieur et madame Martin. | fils | le fils |
| T2-VOC-CTX-005 | Paris est la capitale de la ___. | France | la France |
| T2-VOC-CTX-006 | Lucas et moi avons les mêmes parents. Lucas est mon ___. | frère | le frère |
| T2-VOC-CTX-007 | Dupont est mon ___ de famille. | nom | le nom (de famille) |
| T2-VOC-CTX-008 | Le frère de mon père est mon ___. | oncle | l’oncle |
| T2-VOC-CTX-009 | Ma mère et mon père sont mes ___. | parents | le parent |
| T2-VOC-CTX-010 | Emma et moi avons les mêmes parents. Emma est ma ___. | sœur | la sœur |
| T2-VOC-CTX-011 | La sœur de ma mère est ma ___. | tante | la tante |
| T2-VOC-CTX-012 | Lucas mesure 1 m 90. Il est très ___. | grand | grand(e) |
| T2-VOC-CTX-013 | Emma mesure 1 m 85. Elle est très ___. | grande | grand(e) |
| T2-VOC-CTX-014 | Lucas arrive aujourd’hui pour la première fois dans notre classe. Il est ___. | nouveau | nouveau / nouvelle |
| T2-VOC-CTX-015 | Emma arrive aujourd’hui pour la première fois dans notre classe. Elle est ___. | nouvelle | nouveau / nouvelle |
| T2-VOC-CTX-016 | J’ai deux frères. Lucas a seize ans et Hugo a dix ans. Lucas est l’___. | aîné | l’aîné |
| T2-VOC-CTX-017 | J’ai deux sœurs. Emma a seize ans et Lola a onze ans. Emma est l’___. | aînée | l’aînée |
| T2-VOC-CTX-018 | À la plage, je mets mes vêtements dans une ___. | cabine de plage | la cabine de plage |
| T2-VOC-CTX-019 | Le fils de mon oncle est mon ___. | cousin | le cousin |
| T2-VOC-CTX-020 | La fille de ma tante est ma ___. | cousine | la cousine |
| T2-VOC-CTX-021 | Lucas et moi avons la même mère, mais pas le même père. Lucas est mon ___. | demi-frère | le demi-frère |
| T2-VOC-CTX-022 | Emma et moi avons le même père, mais pas la même mère. Emma est ma ___. | demi-sœur | la demi-sœur |
| T2-VOC-CTX-023 | Je fais un ___ avec un crayon. | dessin | le dessin |
| T2-VOC-CTX-024 | Hugo n’a pas de frère ni de sœur. C’est un ___. | enfant unique | l’enfant unique |
| T2-VOC-CTX-025 | Julie est mariée à Marc. Julie est la ___ de Marc. | femme | la femme |
| T2-VOC-CTX-026 | Marc est marié à Julie. Marc est le ___ de Julie. | mari | le mari |
| T2-VOC-CTX-027 | Paul est un homme de France. C’est un ___. | Français | le Français |
| T2-VOC-CTX-028 | Léa est une femme de France. C’est une ___. | Française | la Française |
| T2-VOC-CTX-029 | Il y a beaucoup de ___ dans la rue. | gens | les gens |
| T2-VOC-CTX-030 | Lucas et Hugo sont frères jumeaux. Lucas est le ___ de Hugo. | jumeau | le jumeau |
| T2-VOC-CTX-031 | Emma et Lola sont sœurs jumelles. Emma est la ___ de Lola. | jumelle | la jumelle |
| T2-VOC-CTX-032 | Le français est une ___. | langue | la langue |
| T2-VOC-CTX-033 | À la plage, le ___ me protège du soleil. | parasol | le parasol |
| T2-VOC-CTX-034 | La fille de mon fils est ma ___. | petite-fille | la petite-fille |
| T2-VOC-CTX-035 | Le fils de ma fille est mon ___. | petit-fils | le petit-fils |
| T2-VOC-CTX-036 | Pour faire de la voile debout sur l’eau, j’utilise une ___. | planche à voile | la planche à voile |
| T2-VOC-CTX-037 | Le contraire du nord, c’est le ___. | sud | le sud |
| T2-VOC-CTX-038 | Mes parents ne veulent plus rester mariés. Ils vont ___. | divorcer | divorcer |
| T2-VOC-CTX-039 | Mon oncle et sa copine habitent ensemble. Ils ___. | cohabitent | cohabiter |
| T2-VOC-CTX-040 | Ses parents ne sont pas ses parents biologiques. Il est ___. | adopté | adopté(e) |
| T2-VOC-CTX-041 | Ses parents ne sont pas ses parents biologiques. Elle est ___. | adoptée | adopté(e) |
| T2-VOC-CTX-042 | Cette pizza est vraiment ___. | délicieuse | délicieux / délicieuse |
| T2-VOC-CTX-043 | Ce gâteau est vraiment ___. | délicieux | délicieux / délicieuse |
| T2-VOC-CTX-044 | Mon oncle n’est plus marié. Il est ___. | divorcé | divorcé(e) |
| T2-VOC-CTX-045 | Cette voiture vient de France. C’est une voiture ___. | française | français(e) |
| T2-VOC-CTX-046 | Julie a un mari. Elle est ___. | mariée | marié(e) |
| T2-VOC-CTX-047 | Il n’est plus vivant. Il est ___. | mort | mort(e) |
| T2-VOC-CTX-048 | Liam est ___ le 5 décembre. | né | né(e) |
| T2-VOC-CTX-049 | Il ne fait jamais rien et ne veut jamais travailler. Il est ___. | paresseux | paresseux / paresseuse |
| T2-VOC-CTX-050 | Elle ne fait jamais rien et ne veut jamais travailler. Elle est ___. | paresseuse | paresseux / paresseuse |
| T2-VOC-CTX-051 | Une cabine de plage pour ranger ses affaires, c’est très ___. | pratique | pratique |
| T2-VOC-CTX-052 | Marie n’habite avec personne. Elle habite ___. | seule | seul(e) |

### Opmerkingen na ambiguity review
- Geen contextvraag voor `cool`, `chouette`, `génial`, `sympa`: te veel overlap.
- Geen vrije contextvragen voor maman/mère, papa/père, mamie/grand-mère, papi/grand-père.
- Geen vrije vraag voor `quelques`: in natuurlijke context zijn numerieke/andere determinatoren te vaak ook correct.
- Geen vrije vraag voor `unique`: `seul(e)` kan in meerdere contexten ook correct zijn.
- Context 038 gebruikt een bronconforme constructie met `aller + divorcer`; het doel is enkel lexicale herkenning.

---

# 5. Expressions / Actes de parole

Hier mag een Nederlandse betekenis, infofiche of communicatieve cue zichtbaar zijn.

## 5.1 Expressions

| ID | Prompt | Antwoord |
|---|---|---|
| T2-EXP-001 | Zeg: Hij zit in het eerste jaar. | Il est en première année. |
| T2-EXP-002 | Zeg: Zij voetbalt. | Elle joue au foot. |
| T2-EXP-003 | Zeg: Hij speelt computerspelletjes. | Il joue à des jeux vidéo. |
| T2-EXP-004 | Zeg: Niet ver van Brussel. | Pas loin de Bruxelles. |
| T2-EXP-005 | Zeg: Zoals ik. | Comme moi. |
| T2-EXP-006 | Zeg: Wij zijn met vier thuis. | Nous sommes quatre à la maison. |
| T2-EXP-007 | Zeg: Ik ga op zondag naar de Chiro/Patro. | Le dimanche, je vais au Patro. |

## 5.2 Familierelaties uitleggen

| ID | Prompt | Antwoord |
|---|---|---|
| T2-FAM-001 | Zeg: Lucas is de broer van Emma. | Lucas est le frère d’Emma. |
| T2-FAM-002 | Zeg: Emma is de halfzus van Lucas. | Emma est la demi-sœur de Lucas. |
| T2-FAM-003 | Zeg: Julie is de mama van Lucas. | Julie est la maman de Lucas. |
| T2-FAM-004 | Zeg: Marc is de papa van Emma. | Marc est le papa d’Emma. |
| T2-FAM-005 | Zeg: Paul is de oom van Lucas. | Paul est l’oncle de Lucas. |
| T2-FAM-006 | Zeg: Marie is de tante van Emma. | Marie est la tante d’Emma. |
| T2-FAM-007 | Zeg: Hugo is de neef van Emma. | Hugo est le cousin d’Emma. |
| T2-FAM-008 | Zeg: Lola is de nicht van Lucas. | Lola est la cousine de Lucas. |
| T2-FAM-009 | Zeg: Pierre is de opa van Emma. | Pierre est le papi d’Emma. |
| T2-FAM-010 | Zeg: Anne is de oma van Lucas. | Anne est la mamie de Lucas. |
| T2-FAM-011 | Zeg: Marc en Julie zijn de ouders van Emma. | Marc et Julie sont les parents d’Emma. |
| T2-FAM-012 | Zeg: Pierre en Anne zijn de grootouders van Emma. | Pierre et Anne sont les grands-parents d’Emma. |

## 5.3 Présenter quelqu’un (2)

| ID | Prompt | Antwoord |
|---|---|---|
| T2-PRES-001 | Vraag: Hoe heet hij? | Il s’appelle comment ? |
| T2-PRES-002 | Vraag: Hoe heet zij? | Elle s’appelle comment ? |
| T2-PRES-003 | Vraag: Wat is zijn/haar familienaam? | C’est quoi, son nom de famille ? |
| T2-PRES-004 | Vraag: Wanneer is hij geboren? | Il est né quand ? |
| T2-PRES-005 | Vraag: Wanneer is zij geboren? | Elle est née quand ? |
| T2-PRES-006 | Vraag: Waar is hij geboren? | Il est né où ? |
| T2-PRES-007 | Vraag: Waar is zij geboren? | Elle est née où ? |
| T2-PRES-008 | Vraag: Hoe oud is hij? | Il a quel âge ? |
| T2-PRES-009 | Vraag: Hoe oud is zij? | Elle a quel âge ? |
| T2-PRES-010 | Vraag: Heeft hij broers of zussen? | Il a des frères ou des sœurs ? |
| T2-PRES-011 | Vraag: Heeft zij broers of zussen? | Elle a des frères ou des sœurs ? |
| T2-PRES-012 | Vraag: Welke talen spreekt hij? | Il parle quelles langues ? |
| T2-PRES-013 | Vraag: Welke talen spreekt zij? | Elle parle quelles langues ? |
| T2-PRES-014 | Vraag: In welk jaar zit hij? | Il est en quelle année ? |
| T2-PRES-015 | Vraag: In welk jaar zit zij? | Elle est en quelle année ? |
| T2-PRES-016 | Vraag: Hoe heet zijn vader? | Le père s’appelle comment ? |
| T2-PRES-017 | Vraag: Hoe heet haar moeder? | La mère s’appelle comment ? |
| T2-PRES-018 | Vraag over meerdere personen: Waar wonen zij? | Ils habitent où ? / Elles habitent où ? |

### Progressie
- Apprendre: Nederlandse cue of infofiche expliciet zichtbaar.
- S’entraîner: meer situationele cue.
- Se tester: zo weinig mogelijk steun.

---

# 6. Atelier Verbes — Les verbes en -IR : types partir et finir

## 6.1 Officiële doelen

### Type partir
1. partir — vertrekken
2. mentir — liegen
3. sentir — ruiken / voelen
4. servir — (be)dienen / opdienen
5. sortir — uitgaan / naar buiten gaan
6. dormir — slapen

### Type finir
7. finir — eindigen / stoppen
8. choisir — kiezen
9. grandir — groeien / groot worden
10. grossir — verdikken
11. maigrir — vermageren
12. réagir — reageren
13. réfléchir — nadenken
14. remplir — (in)vullen
15. rougir — blozen / rood worden

Geen andere -IR-werkwoorden automatisch toevoegen.

## 6.2 Rule-level mastery
Gebruik twee conjugatiegoals:
- `present_ir_partir`
- `present_ir_finir`

Aanbevolen streng Acquis-criterium per regel:
- alle 6 canonieke persoonsgroepen minstens eenmaal correct;
- minimaal 3 verschillende werkwoorden uit de familie;
- minimaal 8 correcte onafhankelijke recalls;
- ≥75% onafhankelijke accuracy;
- verspreid over ≥2 sessies;
- laatste onafhankelijke poging correct.

De 15 lexicale infinitiefitems blijven daarnaast gewone lexicale mastery-items.

## 6.3 Apprendre — micro-uitleg

### Type partir
Voor `partir`:
- je pars
- tu pars
- il/elle/on part
- nous partons
- vous partez
- ils/elles partent

Laat zien dat de meervoudsvormen een andere stamvorm zichtbaar maken.

### Type finir
Voor `finir`:
- je finis
- tu finis
- il/elle/on finit
- nous finissons
- vous finissez
- ils/elles finissent

Benadruk `-iss-` in de meervoudsvormen.

---

# 7. Verbes — Dans une phrase

## 7.1 Type partir

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T2-VERB-CTX-001 | 1 | Je ___ à huit heures. (partir) | pars |
| T2-VERB-CTX-002 | 2 | Lucas ___ demain matin. (partir) | part |
| T2-VERB-CTX-003 | 3 | Emma et moi ___ à neuf heures. (partir) | partons |
| T2-VERB-CTX-004 | 1 | Tu ___ parfois ? (mentir) | mens |
| T2-VERB-CTX-005 | 2 | Hugo ___ à ses parents. (mentir) | ment |
| T2-VERB-CTX-006 | 3 | Lucas et Emma ne ___ jamais. (mentir) | mentent |
| T2-VERB-CTX-007 | 1 | Je ___ les fleurs. (sentir) | sens |
| T2-VERB-CTX-008 | 2 | Emma ___ le parfum. (sentir) | sent |
| T2-VERB-CTX-009 | 3 | Mes amis ___ les fleurs. (sentir) | sentent |
| T2-VERB-CTX-010 | 1 | Nous ___ le repas. (servir) | servons |
| T2-VERB-CTX-011 | 2 | Mon père ___ le dessert. (servir) | sert |
| T2-VERB-CTX-012 | 3 | Emma et Sarah ___ les boissons. (servir) | servent |
| T2-VERB-CTX-013 | 1 | Vous ___ ce soir ? (sortir) | sortez |
| T2-VERB-CTX-014 | 2 | Lucas ___ avec ses amis. (sortir) | sort |
| T2-VERB-CTX-015 | 3 | Mes cousins ___ le samedi. (sortir) | sortent |
| T2-VERB-CTX-016 | 1 | Tu ___ huit heures par nuit. (dormir) | dors |
| T2-VERB-CTX-017 | 2 | Mon frère ___ beaucoup. (dormir) | dort |
| T2-VERB-CTX-018 | 3 | Emma et moi ___ peu. (dormir) | dormons |

## 7.2 Type finir

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T2-VERB-CTX-019 | 1 | Nous ___ les devoirs à cinq heures. (finir) | finissons |
| T2-VERB-CTX-020 | 2 | Le cours ___ à quatre heures. (finir) | finit |
| T2-VERB-CTX-021 | 3 | Les cours ___ à quatre heures. (finir) | finissent |
| T2-VERB-CTX-022 | 1 | Tu ___ quel dessert ? (choisir) | choisis |
| T2-VERB-CTX-023 | 2 | Emma ___ une glace. (choisir) | choisit |
| T2-VERB-CTX-024 | 3 | Lucas et moi ___ un film. (choisir) | choisissons |
| T2-VERB-CTX-025 | 1 | Je ___ vite. (grandir) | grandis |
| T2-VERB-CTX-026 | 2 | Mon petit frère ___ vite. (grandir) | grandit |
| T2-VERB-CTX-027 | 3 | Les enfants ___ vite. (grandir) | grandissent |
| T2-VERB-CTX-028 | 1 | Nous ___ un peu. (grossir) | grossissons |
| T2-VERB-CTX-029 | 2 | Mon chat ___ parce qu’il mange beaucoup. (grossir) | grossit |
| T2-VERB-CTX-030 | 3 | Mes chats ___ un peu. (grossir) | grossissent |
| T2-VERB-CTX-031 | 1 | Je ___ un peu. (maigrir) | maigris |
| T2-VERB-CTX-032 | 2 | Lucas ___ parce qu’il fait beaucoup de sport. (maigrir) | maigrit |
| T2-VERB-CTX-033 | 3 | Mes parents ___ un peu. (maigrir) | maigrissent |
| T2-VERB-CTX-034 | 1 | Vous ___ comment ? (réagir) | réagissez |
| T2-VERB-CTX-035 | 2 | Emma ___ vite. (réagir) | réagit |
| T2-VERB-CTX-036 | 3 | Mes amis ___ bien. (réagir) | réagissent |
| T2-VERB-CTX-037 | 1 | Tu ___ avant de répondre. (réfléchir) | réfléchis |
| T2-VERB-CTX-038 | 2 | Lucas ___ à la question. (réfléchir) | réfléchit |
| T2-VERB-CTX-039 | 3 | Emma et moi ___ ensemble. (réfléchir) | réfléchissons |
| T2-VERB-CTX-040 | 1 | Je ___ le formulaire. (remplir) | remplis |
| T2-VERB-CTX-041 | 2 | Sarah ___ le formulaire. (remplir) | remplit |
| T2-VERB-CTX-042 | 3 | Les élèves ___ le formulaire. (remplir) | remplissent |
| T2-VERB-CTX-043 | 1 | Tu ___ facilement. (rougir) | rougis |
| T2-VERB-CTX-044 | 2 | Emma ___ facilement. (rougir) | rougit |
| T2-VERB-CTX-045 | 3 | Lucas et Emma ___ facilement. (rougir) | rougissent |

### Selectieregels
- balanceer over `je`, `tu`, `il/elle/on`, `nous`, `vous`, `ils/elles`;
- balanceer ook over beide -IR-families;
- infinitief staat zichtbaar bij `Dans une phrase`;
- zinnen mogen eerdere T1-leerstof gebruiken, maar geen nieuwe grammaticale kennis noodzakelijk maken.

---

# 8. Chiffres et lettres — De 0 à 20

## 8.1 Permanente doelen
21 bestaande number-items:
0 t.e.m. 20.

## 8.2 Oefenvormen
### Chiffres → lettres
Voorbeeld:
`14 → quatorze`

### Lettres → chiffres
Voorbeeld:
`dix-sept → 17`

### Korte contextvariant
Voorbeeld:
`Il a ___ ans. (14) → quatorze`

Gebruik context alleen wanneer die geen extra taalprobleem creëert.

## 8.3 Correctie
Doelspellingen:
- zéro
- un
- deux
- trois
- quatre
- cinq
- six
- sept
- huit
- neuf
- dix
- onze
- douze
- treize
- quatorze
- quinze
- seize
- dix-sept
- dix-huit
- dix-neuf
- vingt

Hyphens in 17–19 blijven de doelspelling.
Geen theoretische varianten als nieuwe mastery-items aanmaken.

---

# 9. Atelier Grammaire — La négation

De grammatica wordt opgesplitst in vijf vaardigheden:
1. gewone ontkenning `ne ... pas`
2. `ne ... plus`
3. `ne ... jamais`
4. article après négation
5. uitzondering met `être`

---

# 10. Grammaire 4A — ne ... pas

## 10.1 Gerichte invuloefeningen

| ID | Vraag | Antwoorden |
|---|---|---|
| T2-GRAM-PAS-001 | Je ___ parle ___ français. | ne · pas |
| T2-GRAM-PAS-002 | Tu ___ joues ___ au foot. | ne · pas |
| T2-GRAM-PAS-003 | Il ___ regarde ___ la télé. | ne · pas |
| T2-GRAM-PAS-004 | Elle ___ habite ___ à Paris. | n’ · pas |
| T2-GRAM-PAS-005 | Nous ___ dormons ___ beaucoup. | ne · pas |
| T2-GRAM-PAS-006 | Vous ___ aimez ___ le café. | n’ · pas |
| T2-GRAM-PAS-007 | Ils ___ sortent ___ ce soir. | ne · pas |
| T2-GRAM-PAS-008 | Emma ___ est ___ contente. | n’ · pas |

## 10.2 Zin omzetten

| ID | Positief | Negatief |
|---|---|---|
| T2-GRAM-PAS-009 | Je parle français. | Je ne parle pas français. |
| T2-GRAM-PAS-010 | Tu joues au foot. | Tu ne joues pas au foot. |
| T2-GRAM-PAS-011 | Il habite à Bruxelles. | Il n’habite pas à Bruxelles. |
| T2-GRAM-PAS-012 | Nous dormons beaucoup. | Nous ne dormons pas beaucoup. |
| T2-GRAM-PAS-013 | Vous sortez ce soir. | Vous ne sortez pas ce soir. |
| T2-GRAM-PAS-014 | Elles aiment le basket. | Elles n’aiment pas le basket. |

Microfeedback:
- `ne` vóór het vervoegde werkwoord;
- `pas` erna;
- vóór klinker of stomme h: `n’`.

---

# 11. Grammaire 4B — ne ... plus

Betekenis: **niet meer**.
Gebruik bij een situatie die vroeger wel gold / `encore` ontkent.

| ID | Vraag | Antwoord |
|---|---|---|
| T2-GRAM-PLUS-001 | J’habite encore à Paris. → Je ___ habite ___ à Paris. | n’ · plus |
| T2-GRAM-PLUS-002 | Tu joues encore au foot. → Tu ___ joues ___ au foot. | ne · plus |
| T2-GRAM-PLUS-003 | Il sort encore le samedi. → Il ___ sort ___ le samedi. | ne · plus |
| T2-GRAM-PLUS-004 | Emma est encore en première année. → Emma ___ est ___ en première année. | n’ · plus |
| T2-GRAM-PLUS-005 | Nous cohabitons encore. → Nous ___ cohabitons ___. | ne · plus |
| T2-GRAM-PLUS-006 | Ils habitent encore à Bruxelles. → Ils ___ habitent ___ à Bruxelles. | n’ · plus |

Situatievragen:
| ID | Prompt | Antwoord |
|---|---|---|
| T2-GRAM-PLUS-007 | — Tu habites encore à Liège ? — Non, ... | Non, je n’habite plus à Liège. |
| T2-GRAM-PLUS-008 | — Tu joues encore au foot ? — Non, ... | Non, je ne joue plus au foot. |
| T2-GRAM-PLUS-009 | — Elle sort encore avec ses amis ? — Non, ... | Non, elle ne sort plus avec ses amis. |

---

# 12. Grammaire 4C — ne ... jamais

Betekenis: **nooit**.
Gebruik als ontkenning van `parfois` / `souvent`.

| ID | Vraag | Antwoord |
|---|---|---|
| T2-GRAM-JAM-001 | Je joue souvent au foot. → Je ___ joue ___ au foot. | ne · jamais |
| T2-GRAM-JAM-002 | Tu mens parfois. → Tu ___ mens ___. | ne · jamais |
| T2-GRAM-JAM-003 | Il sort souvent. → Il ___ sort ___. | ne · jamais |
| T2-GRAM-JAM-004 | Elle regarde parfois la télé. → Elle ___ regarde ___ la télé. | ne · jamais |
| T2-GRAM-JAM-005 | Nous dormons parfois ici. → Nous ___ dormons ___ ici. | ne · jamais |
| T2-GRAM-JAM-006 | Ils jouent souvent à des jeux vidéo. → Ils ___ jouent ___ à des jeux vidéo. | ne · jamais |

Situatievragen:
| ID | Prompt | Antwoord |
|---|---|---|
| T2-GRAM-JAM-007 | — Tu mens parfois ? — Non, ... | Non, je ne mens jamais. |
| T2-GRAM-JAM-008 | — Vous sortez souvent ? — Non, ... | Non, nous ne sortons jamais. |
| T2-GRAM-JAM-009 | — Lucas joue parfois au basket ? — Non, ... | Non, Lucas ne joue jamais au basket. |

---

# 13. Grammaire 4D — article après négation

## 13.1 Kernregel
Na een ontkenning:
- `un / une / des` → `de`
- vóór klinker kan `de` → `d’`
- bepaald lidwoord `le / la / l’ / les` verandert niet.

Voorbeelden:
- Il a une sœur. → Il n’a pas de sœur.
- Nous avons des cousins. → Nous n’avons pas de cousins.
- Elle aime les frites. → Elle n’aime pas les frites.

## 13.2 Oefenbank

| ID | Positief | Negatief |
|---|---|---|
| T2-GRAM-ART-001 | Il a une sœur. | Il n’a pas de sœur. |
| T2-GRAM-ART-002 | Elle a un frère. | Elle n’a pas de frère. |
| T2-GRAM-ART-003 | Nous avons des cousins. | Nous n’avons pas de cousins. |
| T2-GRAM-ART-004 | Tu manges une pomme. | Tu ne manges pas de pomme. |
| T2-GRAM-ART-005 | Ils cherchent des photos. | Ils ne cherchent pas de photos. |
| T2-GRAM-ART-006 | Elle aime les frites. | Elle n’aime pas les frites. |
| T2-GRAM-ART-007 | Nous aimons le français. | Nous n’aimons pas le français. |
| T2-GRAM-ART-008 | Lucas adore la musique. | Lucas n’adore pas la musique. |

Contrastvragen:

| ID | Vraag | Antwoord |
|---|---|---|
| T2-GRAM-ART-009 | Elle mange ___ frites. → Elle ne mange pas ___ frites. | des · de |
| T2-GRAM-ART-010 | Elle aime ___ frites. → Elle n’aime pas ___ frites. | les · les |
| T2-GRAM-ART-011 | Il a ___ frère. → Il n’a plus ___ frère. | un · de |
| T2-GRAM-ART-012 | Nous avons ___ cousins. → Nous n’avons jamais ___ cousins à la maison. | des · de |

---

# 14. Grammaire 4E — uitzondering met être

Na `être` verandert het lidwoord niet.

| ID | Positief | Negatief |
|---|---|---|
| T2-GRAM-ETRE-001 | C’est un professeur sympa. | Ce n’est pas un professeur sympa. |
| T2-GRAM-ETRE-002 | C’est une copine de Lola. | Ce n’est pas une copine de Lola. |
| T2-GRAM-ETRE-003 | Il est un enfant unique. | Il n’est pas un enfant unique. |
| T2-GRAM-ETRE-004 | Elle est une Française. | Elle n’est pas une Française. |

Microfeedback bij fout:
> Na **être** blijft `un / une / des` staan.

---

# 15. Grammaire 4F — alles gemengd

## 15.1 Kies de juiste ontkenning

| ID | Prompt | Antwoord |
|---|---|---|
| T2-GRAM-MIX-001 | Tu habites encore à Bruxelles ? → Non, je ... | n’habite plus à Bruxelles |
| T2-GRAM-MIX-002 | Tu joues souvent au foot ? → Non, je ... | ne joue jamais au foot |
| T2-GRAM-MIX-003 | Tu aimes le coca ? → Non, je ... | n’aime pas le coca |
| T2-GRAM-MIX-004 | Elle a encore une sœur à la maison ? → Non, elle ... | n’a plus de sœur à la maison |
| T2-GRAM-MIX-005 | Ils mangent souvent des pommes ? → Non, ils ... | ne mangent jamais de pommes |
| T2-GRAM-MIX-006 | C’est un garçon paresseux ? → Non, ... | ce n’est pas un garçon paresseux |

## 15.2 Mini-contexten

### T2-GRAM-MIX-007
Avant, Lucas habitait à Paris. Maintenant, il habite à Lille.  
Lucas ___ habite ___ à Paris.

Antwoorden: `n’` · `plus`

### T2-GRAM-MIX-008
Emma joue au tennis tous les jours, mais elle ne joue au basket aucun jour.  
Emma ___ joue ___ au basket.

Antwoorden: `ne` · `jamais`

### T2-GRAM-MIX-009
Hugo a un frère, mais il n’a aucune sœur.  
Hugo ___ a ___ de sœur.

Antwoorden: `n’` · `pas`

### T2-GRAM-MIX-010
Julie aime les jeux vidéo, mais elle n’aime pas le foot.  
Julie ___ aime ___ le foot.

Antwoorden: `n’` · `pas`

---

# 16. Révision du trajet 2

Aparte tegel:
**Révision du trajet**
*Alles door elkaar*

Combineert:
- familie-/presentatiewoordenschat;
- Actes de parole;
- -IR-werkwoorden;
- getallen 0–20;
- ontkenning.

---

## 16.1 Volledige zinnen NL → FR

| ID | Nederlands | Correct Frans |
|---|---|---|
| T2-REV-001 | Mijn neef is twaalf jaar. | Mon cousin a douze ans. |
| T2-REV-002 | Mijn nicht heet Emma. | Ma cousine s’appelle Emma. |
| T2-REV-003 | Lucas is enig kind. | Lucas est enfant unique. |
| T2-REV-004 | Mijn broer en ik vertrekken om acht uur. | Mon frère et moi partons à huit heures. |
| T2-REV-005 | Emma slaapt acht uur per nacht. | Emma dort huit heures par nuit. |
| T2-REV-006 | Mijn opa liegt nooit. | Mon papi ne ment jamais. |
| T2-REV-007 | Mijn zus gaat niet meer uit op zaterdag. | Ma sœur ne sort plus le samedi. |
| T2-REV-008 | Wij kiezen een film. | Nous choisissons un film. |
| T2-REV-009 | De kinderen groeien snel. | Les enfants grandissent vite. |
| T2-REV-010 | Ik denk na voor ik antwoord. | Je réfléchis avant de répondre. |
| T2-REV-011 | Wij hebben geen neven. | Nous n’avons pas de cousins. |
| T2-REV-012 | Zij houdt niet van voetbal. | Elle n’aime pas le foot. |
| T2-REV-013 | Hij heeft geen zus. | Il n’a pas de sœur. |
| T2-REV-014 | Zij is geen Française. | Elle n’est pas une Française. |
| T2-REV-015 | Mijn ouders zijn gescheiden. | Mes parents sont divorcés. |

## 16.2 Gemengde invulzinnen

| ID | Vraag | Antwoorden |
|---|---|---|
| T2-REV-016 | Mon frère et moi ___ à huit heures. (partir) | partons |
| T2-REV-017 | Emma et Sarah ___ quel film ? (choisir) | choisissent |
| T2-REV-018 | Lucas ___ huit heures par nuit. (dormir) | dort |
| T2-REV-019 | Mes cousins ne ___ jamais. (mentir) | mentent |
| T2-REV-020 | Elle a ___ frère. → Elle n’a pas ___ frère. | un · de |
| T2-REV-021 | Nous avons ___ cousins. → Nous n’avons plus ___ cousins ici. | des · de |
| T2-REV-022 | Elle aime ___ musique. → Elle n’aime pas ___ musique. | la · la |
| T2-REV-023 | C’est ___ copine de Lola. → Ce n’est pas ___ copine de Lola. | une · une |
| T2-REV-024 | J’habite encore à Paris. → Je ___ habite ___ à Paris. | n’ · plus |
| T2-REV-025 | Il joue souvent au foot. → Il ___ joue ___ au foot. | ne · jamais |

## 16.3 Mini-dialogen / korte teksten

### T2-REV-026 — Présenter quelqu’un
Voici Liam.  
Il ___ onze ans.  
Il ___ à Lourmarin.  
Il est en ___ année.  
Il n’a pas de frère ni de sœur : il est ___.

Antwoorden:
`a` · `habite` · `première` · `enfant unique`

### T2-REV-027 — La famille
Emma est la ___ de Lucas.  
Lucas est le ___ d’Emma.  
Leur mère a une sœur. Cette femme est leur ___.

Antwoorden:
`sœur` · `frère` · `tante`

### T2-REV-028 — Les verbes en -IR
Lucas et Emma ___ à huit heures. (partir)  
Ils ___ un film. (choisir)  
Après le film, Lucas ___ le dessert. (servir)

Antwoorden:
`partent` · `choisissent` · `sert`

### T2-REV-029 — La négation
Avant, Emma jouait souvent au foot. Maintenant, jamais.  
Elle ___ joue ___ au foot.  
Avant, elle habitait à Paris. Maintenant, elle habite à Lille.  
Elle ___ habite ___ à Paris.

Antwoorden:
`ne` · `jamais` · `n’` · `plus`

### T2-REV-030 — Tout ensemble
— Ton cousin s’appelle comment ?  
— Il s’appelle Hugo.  
— Il ___ quel âge ?  
— Il a ___.  
— Il a des frères ou des sœurs ?  
— Non, il ___ a ___ : il est enfant unique.  
— Il sort souvent le samedi ?  
— Non, il ___ sort ___ le samedi.

Doelantwoord voor leeftijd:
`douze ans`

Overige antwoorden:
`a` · `n’` · `pas` · `ne` · `jamais`

---

# 17. UI-regels Trajet 2

## Vocabulaire
Maximaal twee hoofdvormen:
- Traduire / Vertalen
- En contexte / In een zin

## Werkwoorden
Maximaal twee hoofdvormen:
- Conjuguer / Vervoegen
- Dans une phrase / In een zin

De twee -IR-families worden binnen dezelfde module zichtbaar gegroepeerd:
- type partir
- type finir

Geen derde grote oefenknop nodig.

## Grammatica
Leerling ziet in de inhoudskeuze:
- ne ... pas
- ne ... plus
- ne ... jamais
- article après négation
- Mélange / Alles door elkaar

De `être`-uitzondering wordt onderdeel van article après négation / gemengde training en hoeft geen losse grote tegel te zijn.

## Nombres
Eenvoudige aparte tegel:
**De 0 à 20**
Geen onnodige subnavigatie.

---

# 18. Mapping- en implementatieregels voor Codex

1. Gebruik bestaande permanente item-ID’s uit `course.json`.
2. Verander de bestaande 148 Trajet-2-items niet.
3. Verwijder sound_rule-items niet, maar toon de soundmodule niet in de actieve T2-oefeninterface.
4. Variant-ID’s uit dit document zijn oefenvarianten, geen course-items.
5. Vocab-contextvarianten mappen naar het corresponderende bestaande vocabulary-item.
6. Werkwoordcontextvarianten:
   - lexicale infinitiefkennis blijft op het bestaande verb-item;
   - conjugatie-evidence wordt daarnaast toegewezen aan `present_ir_partir` of `present_ir_finir`.
7. Balanceer werkwoordvragen over zes canonieke persoonsgroepen en beide families.
8. Getallen 0–20 gebruiken de bestaande 21 number-items als denominator.
9. Maak geen extra number mastery-items voor context- of omzetvarianten.
10. Grammarvarianten mappen op de vijf bestaande grammar_rule-items:
    - ne ... pas
    - ne ... plus
    - ne ... jamais
    - article après négation
    - négation avec être
11. Bij meer-gatenvragen elk gat apart registreren.
12. Bij integratieve volledige zinnen geen blanket negative mastery bij één fout.
13. Expressions/Actes de parole mogen Nederlandse/situationele cues gebruiken.
14. Contextvragen nooit automatisch door Codex laten genereren.
15. Alle vragen uit deze spec eerst statisch in data opnemen; randomisatie kiest uit deze goedgekeurde bank.
16. Respecteer de bestaande round/task-architectuur en masteryregels uit het project.

---

# 19. Zelfcontrole uitgevoerd

## Controle 1 — brongetrouwheid
Gecontroleerd:
- alleen leerstof uit Trajet 2 en eerder gekende T1-taal gebruikt;
- Kiosque niet als aparte masterybank;
- geen extra -IR-werkwoorden toegevoegd;
- getallen beperkt tot 0–20;
- grammatica beperkt tot de vijf bronregels;
- soundmodule bewust niet geactiveerd.

## Controle 2 — didactiek en ambiguïteit
Gecontroleerd:
- vrije vocabcontexten met sterke synoniemen geschrapt;
- familiepolysemie bij beau-père/belle-mère/beau-frère/belle-sœur niet geforceerd;
- `cool/chouette/génial/sympa` niet als open contexttarget gebruikt;
- contextvragen testen niet onbedoeld extra grammatica;
- werkwoordzinnen tonen altijd het infinitief;
- negatievragen hebben voldoende context om pas/plus/jamais te onderscheiden.

## Controle 3 — technische consistentie
Gecontroleerd:
- variant-ID-prefixen zijn per bank gescheiden;
- geen oefenvariant wordt permanent mastery-item;
- multi-gap scoring is per gat;
- vaste course-items blijven intact;
- number denominator blijft 21;
- sound_rule-items blijven bestaan maar zijn verborgen uit de oefenflow.

---

# 20. Status Trajet 2

Inhoudelijk uitgewerkt:
- Vocabulaire
- Expressions / Actes de parole
- Verbes type partir
- Verbes type finir
- Nombres 0–20
- La négation
- Révision du trajet

Bewust niet als digitale oefenbank:
- Panda-stique !!! / Kiosque
- Le son [e]
- Jeu de l’oie

Trajet 2 kan op basis van deze spec door Codex geïmplementeerd worden zonder nieuwe didactische inhoud te verzinnen.


---

# SOURCE CONTENT — TRAJET 3

# Mon parcours — Trajet 3 Content Spec
Version: v1 — zelfstandig uitgewerkt en meermaals gecontroleerd
Bron: Univers français 1 — Trajet 3
Doel: inhoudelijke bron voor Codex. Codex mag de didactische inhoud niet zelf uitbreiden of herschrijven zonder expliciete instructie.

---

# 0. Algemene afspraken uit Trajet 1 en 2 blijven gelden

## 0.1 Permanente leeritems
De bestaande permanente course-items en item-ID’s blijven onaangeroerd.

Trajet 3 bevat in de huidige dataset exact **235 permanente items**:
- 124 items Atelier Parole (vocabulaire + expressions + Actes de parole)
- 13 werkwoorditems
- 80 number-items (0–79)
- 16 grammar_rule-items voor l’article contracté en vaste constructies
- 2 sound_rule-items

Nieuwe oefenvarianten in dit document zijn **geen nieuwe permanente mastery-items**.

## 0.2 Oefenmodi
- **Apprendre / Leren**
  - begeleid;
  - korte regel/micro-uitleg;
  - na een fout gerichte feedback;
  - geen onafhankelijke mastery-evidence.
- **S’entraîner / Oefenen**
  - zelfstandig;
  - geen antwoord vooraf;
  - gerichte hint pas na fout;
  - onafhankelijke evidence.
- **Se tester / Test jezelf**
  - geen hints tijdens de reeks;
  - feedback op het einde;
  - onafhankelijke evidence.

## 0.3 Antwoordregels
- Accenten strikt.
- `'` en `’` gelijkwaardig.
- Beginhoofdletter niet doorslaggevend.
- Eindpunt niet doorslaggevend.
- Expliciete `accepted_answers` bij echte equivalenten.
- Geen brede fuzzy/AI-correctie.
- Bij bijna-correcte spelling mag een gerichte hint verschijnen.
- Open contextvragen alleen opnemen wanneer de target voldoende eenduidig is.

## 0.4 Ambiguity rule
Voor elke vrije contextvraag:
> Als een ander actief leerwoord uit dezelfde scope logisch in hetzelfde gat past, herschrijf of schrap de vraag.

Liever géén contextoefening dan een dubbelzinnige contextoefening.

## 0.5 Mastery
- Variants mappen naar bestaande leerdoelen.
- Geen nieuwe permanente doelen voor contextzinnen.
- Meer-gatenvragen: elk gat apart beoordelen en evidence registreren.
- Volledige vertaalzin:
  - volledig correct → positieve evidence voor gekoppelde doelen;
  - fout → integratieve vraag fout, maar niet automatisch alle onderliggende doelen negatief bestraffen.

---

# 1. Scope Trajet 3

## Wel digitaal oefenen
1. **Atelier Parole — Proposer une activité / Parler d’un village, d’une ville, d’une région**
   - Traduire / Vertalen
   - En contexte / In een zin
   - Expressions / Actes de parole
2. **Atelier Verbes — Les verbes en -RE, aller et venir**
   - Conjuguer / Vervoegen
   - Dans une phrase / In een zin
3. **Chiffres et lettres — De 0 à 79**
   - chiffres ↔ lettres
4. **Atelier Grammaire — L’article contracté**
   - à + article
   - de + article
   - verbes + à
   - constructions + de
5. **Révision du trajet 3**
   - integratie van vocabulaire, Actes de parole, verbes, nombres, article contracté
   - hergebruik van eerder gekende négation waar de bron dit doet

## Niet als aparte digitale module
- **Kiosque — Alors, on danse ?**
- **Comment dire ? — Six, huit, dix, vingt**: geen audiomodule
- De bronpagina **Les verbes et la négation** wordt gebruikt als inspiratie voor integratieve herhaling, niet als nieuw permanent inhoudsblok.

De bestaande 2 sound_rule-items blijven in de data bestaan, maar worden niet actief aangeboden.

---

# 2. Broninventaris — Atelier Parole

## 2.1 On se rappelle ? — substantifs
- le bois
- la campagne
- le cinéma
- l’école
- l’hôpital
- le jardin
- le magasin (de vêtements)
- le marché
- la place
- le restaurant
- le supermarché
- les toilettes
- le village
- la ville

## 2.2 On se rappelle ? — verbe
- aller

## 2.3 On se rappelle ? — adjectifs
- beau / belle
- chouette
- délicieux / délicieuse
- grand(e)
- petit(e)
- pratique
- super
- sympa

## 2.4 On se rappelle ? — mot invariable
- loin de

## 2.5 On découvre ! — substantifs
- l’attraction touristique
- la banque
- le bâtiment
- la bibliothèque
- la boucherie
- la boulangerie
- la boutique
- le café
- la cathédrale
- le centre(-ville)
- le centre commercial
- le château
- le commerce
- l’église
- la friterie
- la gare
- l’hôtel
- le musée
- le parc
- la pharmacie
- la piscine
- la pizzeria
- la poste
- la rue (commerçante)
- la salle de sport
- le stade (de foot)
- la supérette
- la terrasse

## 2.6 On découvre ! — verbes
- faire de l’escalade
- loger
- visiter

## 2.7 On découvre ! — adjectifs
- agréable
- animé(e)
- calme
- charmant(e)
- ennuyeux / ennuyeuse
- magnifique
- vivant(e)

## 2.8 On découvre ! — mots invariables
- à côté de
- en face de
- (tout) près de
- souvent

## 2.9 Expressions
- faire une activité (sportive)
- je suis désolé(e)
- on (y) va ensemble
- pas de soucis
- prendre un verre

---

# 3. Vocabulaire — oefenarchitectuur

## 3.1 Traduire / Vertalen
Bestaande FR↔NL-oefenvorm behouden.

### Richtingsregels voor ambigue items
Sommige Nederlandse cues zijn niet uniek genoeg voor een eerlijke NL→FR-vraag.

Gebruik bij voorkeur FR→NL of een verduidelijkte NL-cue voor:
- `chouette`, `sympa`, `super`
- `animé(e)` en `vivant(e)` — beide kunnen “levendig” betekenen
- `agréable`, `charmant(e)`, `magnifique` wanneer de Nederlandse cue te algemeen “mooi/leuk” wordt
- `magasin` tegenover `boutique`
- `centre(-ville)` tegenover `centre commercial`

Aanbevolen disambiguatie in NL→FR:
- `animé(e)` → “bruisend, levendig”
- `vivant(e)` → “levendig, vol leven”
- `le magasin de vêtements` → “de kledingwinkel”
- `la boutique` → “de boetiek”
- `le centre(-ville)` → “het stadscentrum”
- `le centre commercial` → “het winkelcentrum”

## 3.2 En contexte / In een zin
- Franse context;
- geen Nederlandse target tussen haakjes;
- artikel meestal al zichtbaar wanneer enkel het lexicale woord wordt getest;
- vormvariant mapt terug naar hetzelfde permanente item;
- geen open context voor woorden met te veel plausibele synoniemen.

---

# 4. Vocabulaire — En contexte bank

## 4.1 On se rappelle ?

| ID | Prompt | Antwoord |
|---|---|---|
| T3-VOC-CTX-001 | On se promène entre les arbres dans le ___. | bois |
| T3-VOC-CTX-002 | Je n’habite pas en ville. J’habite à la ___. | campagne |
| T3-VOC-CTX-003 | Je vais au ___ pour regarder un film. | cinéma |
| T3-VOC-CTX-004 | Les élèves vont à l’___ du lundi au vendredi. | école |
| T3-VOC-CTX-005 | Le médecin travaille à l’___. | hôpital |
| T3-VOC-CTX-006 | Derrière la maison, il y a un ___ avec des fleurs. | jardin |
| T3-VOC-CTX-007 | J’achète un teeshirt dans un magasin de ___. | vêtements |
| T3-VOC-CTX-008 | Le samedi, on achète des fruits et des légumes au ___. | marché |
| T3-VOC-CTX-009 | Au centre de la ville, il y a une grande ___ avec une fontaine. | place |
| T3-VOC-CTX-010 | Nous mangeons au ___ ce soir. | restaurant |
| T3-VOC-CTX-011 | J’achète du lait et des pommes au ___. | supermarché |
| T3-VOC-CTX-012 | Je dois aller aux ___. | toilettes |
| T3-VOC-CTX-013 | Il y a seulement 500 habitants. C’est un petit ___. | village |
| T3-VOC-CTX-014 | Bruxelles est une grande ___. | ville |
| T3-VOC-CTX-015 | Mon école est à vingt kilomètres. Elle est ___ de chez moi. | loin |

Geen vrije contextvragen voor `beau/belle`, `chouette`, `sympa`, `super` wegens overlap.

## 4.2 On découvre ! — bâtiments et lieux

| ID | Prompt | Antwoord |
|---|---|---|
| T3-VOC-CTX-016 | Le château de Bouillon est une ___ très connue. | attraction touristique |
| T3-VOC-CTX-017 | Je retire de l’argent à la ___. | banque |
| T3-VOC-CTX-018 | L’école est un grand ___. | bâtiment |
| T3-VOC-CTX-019 | J’emprunte des livres à la ___. | bibliothèque |
| T3-VOC-CTX-020 | J’achète de la viande à la ___. | boucherie |
| T3-VOC-CTX-021 | J’achète du pain et des croissants à la ___. | boulangerie |
| T3-VOC-CTX-022 | Ma tante vend des vêtements dans sa ___. | boutique |
| T3-VOC-CTX-023 | On boit un verre au ___. | café |
| T3-VOC-CTX-024 | C’est une très grande église importante : une ___. | cathédrale |
| T3-VOC-CTX-025 | J’habite au ___, près de tous les magasins. | centre |
| T3-VOC-CTX-026 | Il y a beaucoup de magasins dans le ___. | centre commercial |
| T3-VOC-CTX-027 | Un roi habitait autrefois dans ce ___. | château |
| T3-VOC-CTX-028 | Une boulangerie est un ___. | commerce |
| T3-VOC-CTX-029 | Le dimanche, mes grands-parents vont à l’___. | église |
| T3-VOC-CTX-030 | En Belgique, on va à la ___ pour manger des frites. | friterie |
| T3-VOC-CTX-031 | Je prends le train à la ___. | gare |
| T3-VOC-CTX-032 | En vacances, nous dormons à l’___. | hôtel |
| T3-VOC-CTX-033 | On regarde des tableaux et des objets anciens au ___. | musée |
| T3-VOC-CTX-034 | Les enfants jouent dans le ___. | parc |
| T3-VOC-CTX-035 | J’achète des médicaments à la ___. | pharmacie |
| T3-VOC-CTX-036 | Je vais nager à la ___. | piscine |
| T3-VOC-CTX-037 | Nous allons manger une pizza à la ___. | pizzeria |
| T3-VOC-CTX-038 | J’envoie une lettre à la ___. | poste |
| T3-VOC-CTX-039 | Il y a beaucoup de magasins dans cette rue ___. | commerçante |
| T3-VOC-CTX-040 | Je fais mon entraînement dans la ___. | salle de sport |
| T3-VOC-CTX-041 | On regarde un match de foot au ___. | stade |
| T3-VOC-CTX-042 | C’est un petit magasin où on achète de la nourriture : une ___. | supérette |
| T3-VOC-CTX-043 | Quand il fait beau, nous buvons quelque chose sur la ___. | terrasse |

## 4.3 On découvre ! — verbes / mots

| ID | Prompt | Antwoord |
|---|---|---|
| T3-VOC-CTX-044 | En Ardèche, j’aime ___ sur les rochers. | faire de l’escalade |
| T3-VOC-CTX-045 | Ce week-end, nous allons ___ chez papi. | loger |
| T3-VOC-CTX-046 | Demain, nous allons ___ le musée. | visiter |
| T3-VOC-CTX-047 | Il n’y a presque pas de voitures ni de bruit. Le village est très ___. | calme |
| T3-VOC-CTX-048 | Il n’y a rien à faire ici. Le village est ___. | ennuyeux |
| T3-VOC-CTX-049 | Nous faisons du sport quatre fois par semaine. Nous faisons ___ une activité sportive. | souvent |

Geen vrije contextvragen voor:
- agréable / charmant(e) / magnifique;
- animé(e) / vivant(e);
omdat meerdere targetwoorden in dezelfde context vaak verdedigbaar zijn.

---

# 5. Expressions / Actes de parole

## 5.1 Expressions

| ID | Prompt | Antwoord |
|---|---|---|
| T3-EXP-001 | Zeg: Ik doe een sportactiviteit. | Je fais une activité sportive. |
| T3-EXP-002 | Zeg: Het spijt me. | Je suis désolé(e). |
| T3-EXP-003 | Zeg: We gaan er samen heen. | On y va ensemble. |
| T3-EXP-004 | Zeg: Geen zorgen. | Pas de soucis. |
| T3-EXP-005 | Zeg: We gaan iets drinken. | On va prendre un verre. |

## 5.2 Proposer une activité — directe taalhandelingen

De bestaande permanente Actes-de-parole-items blijven de primaire targets.

Belangrijke bronzinnen:
- Ça te dit d’aller au cinéma ?
- Tu as envie de nager ?
- On va faire du shopping ?
- Pourquoi ne pas jouer au padel ?
- On va à la bibliothèque ?
- On va manger un sandwich ?
- On va prendre un verre en terrasse ?
- On fait une partie de tennis ?
- Tu es libre samedi prochain, à 14 heures ?
- Et dimanche à 10 heures ?
- Super, alors tu viens chez moi à 9 h 30 ?
- On part vers 10 h 30 ?

## 5.3 Réactions — positieve/negatieve antwoorden
De bestaande phrase-items blijven targets:
- Oui, super !
- Génial !
- J’aime bien.
- J’adore !
- D’accord.
- Chouette.
- Bonne idée.
- O.K., c’est original !
- Nickel.
- Non, désolé(e), je n’ai pas envie.
- Bof, je ne suis plus libre.
- Je ne sais pas. Ça ne me dit rien.
- Pas du tout, ce n’est pas mon truc.
- Oui, je n’ai rien à faire.
- Dommage, je ne suis pas libre.
- Non, je vais chez les scouts.
- D’accord ! Rendez-vous chez toi.
- O.K.
- Ça va pour moi.
- Parfait !

## 5.4 Situationele oefenvarianten

| ID | Situatie | Verwacht antwoord |
|---|---|---|
| T3-ACT-001 | Stel voor om naar de bioscoop te gaan. | Ça te dit d’aller au cinéma ? |
| T3-ACT-002 | Vraag of iemand zin heeft om te zwemmen. | Tu as envie de nager ? |
| T3-ACT-003 | Stel voor om te gaan shoppen. | On va faire du shopping ? |
| T3-ACT-004 | Stel voor om te gaan padellen met `Pourquoi ne pas ... ?` | Pourquoi ne pas jouer au padel ? |
| T3-ACT-005 | Stel voor om naar de bibliotheek te gaan. | On va à la bibliothèque ? |
| T3-ACT-006 | Stel voor om een broodje te eten. | On va manger un sandwich ? |
| T3-ACT-007 | Stel voor om iets te drinken op een terras. | On va prendre un verre en terrasse ? |
| T3-ACT-008 | Stel voor om tennis te spelen. | On fait une partie de tennis ? |
| T3-ACT-009 | Vraag of iemand volgende zaterdag om 14 uur vrij is. | Tu es libre samedi prochain, à 14 heures ? |
| T3-ACT-010 | Reageer enthousiast: Geweldig! | Génial ! |
| T3-ACT-011 | Reageer: Goed idee. | Bonne idée. |
| T3-ACT-012 | Weiger beleefd: Sorry, ik heb geen zin. | Non, désolé(e), je n’ai pas envie. |
| T3-ACT-013 | Reageer: Jammer, ik ben niet vrij. | Dommage, je ne suis pas libre. |
| T3-ACT-014 | Maak een afspraak: Akkoord, afspraak bij jou. | D’accord ! Rendez-vous chez toi. |
| T3-ACT-015 | Reageer: Dat gaat voor mij. | Ça va pour moi. |

### Belangrijke datasetcorrectie
In de huidige gestructureerde dataset staat bij:
`Pourquoi ne pas jouer au padel ?`
de Nederlandse cue **“Waarom niet gaan voetballen?”**.

Dit is inhoudelijk fout/mismatch.
Gebruik:
**“Waarom niet gaan padellen?”**
De Franse bronzin blijft:
`Pourquoi ne pas jouer au padel ?`

---

# 6. Parler d’un village, d’une ville, d’une région

De bestaande permanente phrase-items blijven de primaire targets:
- Tu habites où ?
- J’habite dans le centre.
- J’habite à la campagne.
- J’habite à la mer.
- J’habite (tout) près de la boulangerie.
- Mon village se trouve entre Dijon et Lyon.
- Mon village se trouve près de Nantes.
- Mon village se trouve à 20 km d’ici.
- Il est comment, ton village ?
- Il est charmant.
- Il est agréable.
- Il est petit.
- Il est calme.
- Il est ennuyeux.
- Elle est comment, ta ville ?
- Elle est vivante.
- Elle est magnifique.
- Elle est grande.
- Elle est animée.
- Il y a beaucoup de magasins.
- Il y a peu de magasins.

## Situationele varianten

| ID | Prompt | Antwoord |
|---|---|---|
| T3-VILL-001 | Vraag: Waar woon je? | Tu habites où ? |
| T3-VILL-002 | Zeg: Ik woon in het centrum. | J’habite dans le centre. |
| T3-VILL-003 | Zeg: Ik woon op het platteland. | J’habite à la campagne. |
| T3-VILL-004 | Zeg: Ik woon aan zee. | J’habite à la mer. |
| T3-VILL-005 | Zeg: Ik woon vlak bij de bakkerij. | J’habite tout près de la boulangerie. |
| T3-VILL-006 | Zeg: Mijn dorp ligt tussen Dijon en Lyon. | Mon village se trouve entre Dijon et Lyon. |
| T3-VILL-007 | Zeg: Mijn dorp ligt op 20 km hiervandaan. | Mon village se trouve à 20 km d’ici. |
| T3-VILL-008 | Vraag: Hoe is je dorp? | Il est comment, ton village ? |
| T3-VILL-009 | Zeg: Mijn dorp is rustig. | Il est calme. |
| T3-VILL-010 | Zeg: Mijn dorp is saai. | Il est ennuyeux. |
| T3-VILL-011 | Vraag: Hoe is je stad? | Elle est comment, ta ville ? |
| T3-VILL-012 | Zeg: Mijn stad is bruisend. | Elle est animée. |
| T3-VILL-013 | Zeg: Mijn stad is prachtig. | Elle est magnifique. |
| T3-VILL-014 | Zeg: Er zijn veel winkels. | Il y a beaucoup de magasins. |
| T3-VILL-015 | Zeg: Er zijn weinig winkels. | Il y a peu de magasins. |

---

# 7. Atelier Verbes — inventaris

## 7.1 Officiële werkwoorddoelen

### Aller
1. aller

### Familie venir
2. venir
3. revenir
4. tenir
5. retenir

### Verbes en -RE
6. attendre
7. descendre
8. entendre
9. perdre
10. rendre
11. rendre visite à
12. répondre
13. vendre

Geen andere werkwoorden automatisch toevoegen aan de T3-conjugatiemodule.

## 7.2 Aanbevolen conjugatiegoals
- `present_aller` — apart/onregelmatig
- `present_venir_family` — venir/revenir/tenir/retenir
- `present_re` — regelmatige -RE-groep

Lexicale infinitiefkennis blijft daarnaast op de bestaande verb-items.

### Streng Acquis voor `present_venir_family` en `present_re`
- alle 6 canonieke persoonsgroepen minstens eenmaal correct;
- ≥3 verschillende werkwoorden binnen de familie;
- ≥8 correcte onafhankelijke recalls;
- ≥75% accuracy;
- ≥2 sessies;
- laatste onafhankelijke poging correct.

Voor `aller`:
- alle 6 persoonsgroepen;
- ≥6 correcte onafhankelijke recalls;
- ≥75% accuracy;
- ≥2 sessies;
- laatste correct.

---

# 8. Verbes — Dans une phrase

## 8.1 Aller

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T3-VERB-CTX-001 | 1 | Je ___ au cinéma. (aller) | vais |
| T3-VERB-CTX-002 | 1 | Nous ___ à la piscine. (aller) | allons |
| T3-VERB-CTX-003 | 2 | Emma ___ à l’école. (aller) | va |
| T3-VERB-CTX-004 | 3 | Lucas et Emma ___ au centre commercial. (aller) | vont |

## 8.2 Venir-familie

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T3-VERB-CTX-005 | 1 | Tu ___ chez moi ce soir ? (venir) | viens |
| T3-VERB-CTX-006 | 2 | Sarah ___ à quatorze heures. (venir) | vient |
| T3-VERB-CTX-007 | 3 | Mes amis ___ à la fête. (venir) | viennent |
| T3-VERB-CTX-008 | 1 | Nous ___ demain. (revenir) | revenons |
| T3-VERB-CTX-009 | 2 | Hugo ___ après le match. (revenir) | revient |
| T3-VERB-CTX-010 | 3 | Lucas et Emma ___ dimanche. (revenir) | reviennent |
| T3-VERB-CTX-011 | 1 | Je ___ mon sac. (tenir) | tiens |
| T3-VERB-CTX-012 | 2 | Emma ___ le ballon. (tenir) | tient |
| T3-VERB-CTX-013 | 3 | Mes amis ___ leurs sacs. (tenir) | tiennent |
| T3-VERB-CTX-014 | 1 | Tu ___ bien les noms. (retenir) | retiens |
| T3-VERB-CTX-015 | 2 | Lucas ___ la réponse. (retenir) | retient |
| T3-VERB-CTX-016 | 3 | Les élèves ___ les nouveaux mots. (retenir) | retiennent |

## 8.3 Verbes en -RE

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T3-VERB-CTX-017 | 1 | Nous ___ le bus. (attendre) | attendons |
| T3-VERB-CTX-018 | 2 | Emma ___ devant la gare. (attendre) | attend |
| T3-VERB-CTX-019 | 3 | Lucas et moi ___ nos amis. (attendre) | attendons |
| T3-VERB-CTX-020 | 1 | Je ___ du bus. (descendre) | descends |
| T3-VERB-CTX-021 | 2 | Hugo ___ du train. (descendre) | descend |
| T3-VERB-CTX-022 | 3 | Les élèves ___ du bus. (descendre) | descendent |
| T3-VERB-CTX-023 | 1 | Tu ___ la musique ? (entendre) | entends |
| T3-VERB-CTX-024 | 2 | Emma ___ le train. (entendre) | entend |
| T3-VERB-CTX-025 | 3 | Mes amis ___ la musique. (entendre) | entendent |
| T3-VERB-CTX-026 | 1 | Je ___ souvent mes clés. (perdre) | perds |
| T3-VERB-CTX-027 | 2 | Lucas ___ son téléphone. (perdre) | perd |
| T3-VERB-CTX-028 | 3 | Emma et Sarah ___ leurs clés. (perdre) | perdent |
| T3-VERB-CTX-029 | 1 | Vous ___ les livres à la bibliothèque. (rendre) | rendez |
| T3-VERB-CTX-030 | 2 | Hugo ___ le livre demain. (rendre) | rend |
| T3-VERB-CTX-031 | 3 | Mes amis ___ leurs livres. (rendre) | rendent |
| T3-VERB-CTX-032 | 1 | Nous ___ à mamie dimanche. (rendre visite) | rendons visite |
| T3-VERB-CTX-033 | 2 | Emma ___ à son grand-père. (rendre visite) | rend visite |
| T3-VERB-CTX-034 | 3 | Lucas et Emma ___ à leurs cousins. (rendre visite) | rendent visite |
| T3-VERB-CTX-035 | 1 | Tu ___ à la question. (répondre) | réponds |
| T3-VERB-CTX-036 | 2 | Sarah ___ au professeur. (répondre) | répond |
| T3-VERB-CTX-037 | 3 | Les élèves ___ aux questions. (répondre) | répondent |
| T3-VERB-CTX-038 | 1 | Nous ___ des gaufres. (vendre) | vendons |
| T3-VERB-CTX-039 | 2 | Le magasin ___ des vêtements. (vendre) | vend |
| T3-VERB-CTX-040 | 3 | Les commerçants ___ des fruits. (vendre) | vendent |

## 8.4 Gemengde werkwoordbank

| ID | Vraag | Antwoord |
|---|---|---|
| T3-VERB-MIX-001 | Mes copains ___ de la piscine en voiture. (revenir) | reviennent |
| T3-VERB-MIX-002 | Nous ___ le train devant la gare. (attendre) | attendons |
| T3-VERB-MIX-003 | Tu ___ au centre commercial ? (aller) | vas |
| T3-VERB-MIX-004 | Ma mère ___ à sa sœur dimanche. (rendre visite) | rend visite |
| T3-VERB-MIX-005 | Les élèves ___ bien les nouveaux mots. (retenir) | retiennent |
| T3-VERB-MIX-006 | Je ___ de l’école à quatre heures. (revenir) | reviens |
| T3-VERB-MIX-007 | Vous ___ à cette question ? (répondre) | répondez |
| T3-VERB-MIX-008 | Emma ___ son sac dans le train. (perdre) | perd |
| T3-VERB-MIX-009 | Ils ___ du bus devant l’école. (descendre) | descendent |
| T3-VERB-MIX-010 | On ___ du pain au marché. (vendre) | vend |

Selectie balanceert:
- zes persoonsgroepen;
- aller;
- venir-familie;
- -RE-familie.

---

# 9. Chiffres et lettres — De 0 à 79

## 9.1 Permanente mastery
Exact 80 bestaande number-items: 0 t.e.m. 79.

Geen gegenereerde varianten toevoegen aan de denominator.

## 9.2 Oefenvormen
### Chiffres → lettres
`46 → quarante-six`

### Lettres → chiffres
`cinquante-cinq → 55`

### Context
- prijzen
- leeftijden
- uren/minuten wanneer de constructie reeds bekend is
- eenvoudige aantallen

Voorbeelden:
- `La jupe coûte 42 euros. → quarante-deux`
- `Il y a 63 personnes. → soixante-trois`

## 9.3 70–79: Belgische én Franse vormen
Primaire Belgische schoolvorm:
- 70 `septante`
- 71 `septante-et-un`
- ...
- 79 `septante-neuf`

Accepted answers:
- 70 `soixante-dix`
- 71 `soixante-et-onze`
- ...
- 79 `soixante-dix-neuf`

De Belgische vorm blijft de primaire weergave omdat de cursus die in de hoofdreeks gebruikt.
De Franse variant wordt als correct alternatief geaccepteerd.

## 9.4 Spelling
Hyphens volgen de bestaande dataset/cursus.
Geen negatieve mastery op een number-item door een puur typografische apostrofkwestie.

---

# 10. Atelier Grammaire — L’article contracté

## 10.1 Permanente grammar targets

### À
- à + le → au
- à + la → à la
- à + l’ → à l’
- à + les → aux

### De
- de + le → du
- de + la → de la
- de + l’ → de l’
- de + les → des

### Verbes + à
- penser à
- téléphoner à
- demander à

### Constructions + de
- rêver de
- à droite de
- à gauche de
- en face de
- à côté de

---

# 11. Grammaire 5A — à + article

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-A-001 | Je vais ___ parc. | au |
| T3-GRAM-A-002 | Tu vas ___ gare. | à la |
| T3-GRAM-A-003 | Elle va ___ école. | à l’ |
| T3-GRAM-A-004 | Nous allons ___ toilettes. | aux |
| T3-GRAM-A-005 | Lucas va ___ cinéma. | au |
| T3-GRAM-A-006 | Emma va ___ bibliothèque. | à la |
| T3-GRAM-A-007 | Vous allez ___ hôpital. | à l’ |
| T3-GRAM-A-008 | Ils vont ___ jardins. | aux |
| T3-GRAM-A-009 | On va ___ marché. | au |
| T3-GRAM-A-010 | Je vais ___ piscine. | à la |

Apprendre-feedback:
- `à + le = au`
- `à + les = aux`
- `à + la` en `à + l’` blijven twee woorden.

---

# 12. Grammaire 5B — de + article

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-DE-001 | Je viens ___ marché. | du |
| T3-GRAM-DE-002 | Tu viens ___ gare. | de la |
| T3-GRAM-DE-003 | Elle vient ___ école. | de l’ |
| T3-GRAM-DE-004 | Nous venons ___ toilettes. | des |
| T3-GRAM-DE-005 | Lucas revient ___ cinéma. | du |
| T3-GRAM-DE-006 | Emma revient ___ bibliothèque. | de la |
| T3-GRAM-DE-007 | Vous venez ___ hôtel. | de l’ |
| T3-GRAM-DE-008 | Ils reviennent ___ jardins. | des |
| T3-GRAM-DE-009 | On vient ___ parc. | du |
| T3-GRAM-DE-010 | Je viens ___ piscine. | de la |

Apprendre-feedback:
- `de + le = du`
- `de + les = des`
- `de + la` en `de + l’` blijven twee woorden.

---

# 13. Grammaire 5C — aller ↔ venir in context

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-MOVE-001 | Je vais ___ boulangerie. | à la |
| T3-GRAM-MOVE-002 | Je viens ___ boulangerie. | de la |
| T3-GRAM-MOVE-003 | Nous allons ___ musée. | au |
| T3-GRAM-MOVE-004 | Nous venons ___ musée. | du |
| T3-GRAM-MOVE-005 | Ils vont ___ toilettes. | aux |
| T3-GRAM-MOVE-006 | Ils viennent ___ toilettes. | des |
| T3-GRAM-MOVE-007 | Elle va ___ hôpital. | à l’ |
| T3-GRAM-MOVE-008 | Elle vient ___ hôpital. | de l’ |

Dit is een belangrijke contrastbank:
- **où va-t-on ?** → à
- **d’où vient-on ?** → de

---

# 14. Grammaire 5D — verbes + à

## 14.1 Penser à

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-VP-001 | Je pense ___ parc. | au |
| T3-GRAM-VP-002 | Je pense ___ piscine. | à la |
| T3-GRAM-VP-003 | Je pense ___ école. | à l’ |
| T3-GRAM-VP-004 | Je pense ___ vacances. | aux |

## 14.2 Téléphoner à

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-VP-005 | Je téléphone ___ professeur. | au |
| T3-GRAM-VP-006 | Je téléphone ___ tante de Lucas. | à la |
| T3-GRAM-VP-007 | Je téléphone ___ élèves. | aux |

## 14.3 Demander à

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-VP-008 | Je demande le chemin ___ passant. | au |
| T3-GRAM-VP-009 | Nous demandons l’adresse ___ professeure. | à la |
| T3-GRAM-VP-010 | Il demande l’heure ___ élèves. | aux |

Elke variant mapt ook naar het passende specifieke grammar_rule-item (`penser à`, `téléphoner à`, `demander à`) naast de vormkennis waar de architectuur dat toelaat.

---

# 15. Grammaire 5E — rêver de / plaatsbepalingen + de

## 15.1 Rêver de

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-PREP-001 | Je rêve ___ vacances. | des |
| T3-GRAM-PREP-002 | Elle rêve ___ château. | du |
| T3-GRAM-PREP-003 | Nous rêvons ___ mer. | de la |
| T3-GRAM-PREP-004 | Il rêve ___ hôtel magnifique. | de l’ |

## 15.2 Plaatsrelaties

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-PREP-005 | La banque est à côté ___ poste. | de la |
| T3-GRAM-PREP-006 | Le café est en face ___ gare. | de la |
| T3-GRAM-PREP-007 | Le musée est à droite ___ hôtel. | de l’ |
| T3-GRAM-PREP-008 | La pharmacie est à gauche ___ supermarché. | du |
| T3-GRAM-PREP-009 | L’école est à côté ___ parc. | du |
| T3-GRAM-PREP-010 | La boulangerie est en face ___ toilettes. | des |

Bij deze vragen wordt niet het voorzetsel zelf geraden als er geen visuele/contextuele informatie is.
Het vaste voorzetsel (`à côté de`, `en face de`, enz.) staat in de zin; de leerling vervolledigt de contractie.

---

# 16. Grammaire 5F — gemengd

| ID | Vraag | Antwoord |
|---|---|---|
| T3-GRAM-MIX-001 | Tu vas ___ centre commercial. | au |
| T3-GRAM-MIX-002 | Tu viens ___ centre commercial. | du |
| T3-GRAM-MIX-003 | Nous allons ___ gare. | à la |
| T3-GRAM-MIX-004 | Nous revenons ___ gare. | de la |
| T3-GRAM-MIX-005 | Je téléphone ___ coach. | au |
| T3-GRAM-MIX-006 | La banque est en face ___ poste. | de la |
| T3-GRAM-MIX-007 | Ils pensent ___ vacances. | aux |
| T3-GRAM-MIX-008 | Elle rêve ___ musée de Paris. | du |
| T3-GRAM-MIX-009 | Le parc est à côté ___ école. | de l’ |
| T3-GRAM-MIX-010 | Vous demandez le chemin ___ passants. | aux |

---

# 17. Révision du trajet 3

Aparte tegel:
**Révision du trajet**
*Alles door elkaar*

Combineert:
- vocabulaire lieux/ville;
- proposer une activité;
- parler d’un village/ville;
- aller/venir/-RE;
- nombres 0–79;
- article contracté;
- beperkte herhaling van negatie uit Trajet 2 waar zinvol.

---

## 17.1 Volledige zinnen NL → FR

| ID | Nederlands | Correct Frans |
|---|---|---|
| T3-REV-001 | Ik ga naar de bakkerij. | Je vais à la boulangerie. |
| T3-REV-002 | Wij komen van het station. | Nous venons de la gare. |
| T3-REV-003 | Lucas gaat naar het park. | Lucas va au parc. |
| T3-REV-004 | Emma komt van het zwembad. | Emma vient de la piscine. |
| T3-REV-005 | Mijn vrienden wachten op de bus. | Mes amis attendent le bus. |
| T3-REV-006 | Ik antwoord op de vraag. | Je réponds à la question. |
| T3-REV-007 | Wij bezoeken onze grootouders. | Nous rendons visite à nos grands-parents. |
| T3-REV-008 | De winkel verkoopt kleren. | Le magasin vend des vêtements. |
| T3-REV-009 | Mijn dorp ligt vlak bij Nantes. | Mon village se trouve près de Nantes. |
| T3-REV-010 | Mijn stad is bruisend. | Ma ville est animée. |
| T3-REV-011 | Er zijn veel winkels. | Il y a beaucoup de magasins. |
| T3-REV-012 | Zullen we naar de bioscoop gaan? | Ça te dit d’aller au cinéma ? |
| T3-REV-013 | Sorry, ik heb geen zin. | Désolé(e), je n’ai pas envie. |
| T3-REV-014 | De bank ligt tegenover het station. | La banque est en face de la gare. |
| T3-REV-015 | Ik denk aan de vakantie. | Je pense aux vacances. |

## 17.2 Gemengde invulzinnen

| ID | Vraag | Antwoorden |
|---|---|---|
| T3-REV-016 | Nous ___ au musée. (aller) | allons |
| T3-REV-017 | Emma ___ de la gare. (venir) | vient |
| T3-REV-018 | Mes amis ___ le bus. (attendre) | attendent |
| T3-REV-019 | Tu ___ bien les nouveaux mots. (retenir) | retiens |
| T3-REV-020 | Je vais ___ marché et je viens ___ marché. | au · du |
| T3-REV-021 | La pharmacie est à côté ___ supermarché. | du |
| T3-REV-022 | Nous téléphonons ___ professeur. | au |
| T3-REV-023 | Ils pensent ___ vacances. | aux |
| T3-REV-024 | Vous allez ___ toilettes. | aux |
| T3-REV-025 | Lucas revient ___ école. | de l’ |

## 17.3 Nombres in context

| ID | Vraag | Antwoord |
|---|---|---|
| T3-REV-026 | Écris 46 en lettres. | quarante-six |
| T3-REV-027 | Écris `septante-trois` en chiffres. | 73 |
| T3-REV-028 | La jupe coûte 42 €. Écris le nombre en lettres. | quarante-deux |
| T3-REV-029 | Il y a 70 personnes. Écris le nombre en lettres. | septante |
| T3-REV-030 | Écris `soixante-dix-neuf` en chiffres. | 79 |

Bij de 70-vraag accepteer ook `soixante-dix`.

## 17.4 Mini-dialogen

### T3-REV-031 — Une activité
— Tu es libre samedi ?  
— Oui. Pourquoi ?  
— Ça te dit d’___ au cinéma ?  
— Oui, super ! On ___ ensemble.

Antwoorden:
`aller` · `y va`

### T3-REV-032 — Se déplacer
— Tu vas où ?  
— Je vais ___ centre commercial.  
— Et tu reviens d’où ?  
— Je reviens ___ centre commercial.

Antwoorden:
`au` · `du`

### T3-REV-033 — La ville
J’habite dans une petite ville.  
Il y a une bibliothèque, un parc et un ___.  
La pharmacie est en face ___ parc.  
Ma ville est calme mais très agréable.

Antwoorden:
`cinéma` (of een vooraf gekoppeld specifiek target uit een vaste variant)
`du`

Technische notitie:
Voor het eerste gat van deze variant moet de getoonde versie een vooraf vastgelegd target hebben; niet random open laten als meerdere gebouwen mogelijk zijn.

### T3-REV-034 — Verbes
Lucas et Emma ___ à la gare. (aller)  
Ils ___ le train. (attendre)  
Après le voyage, ils ___ du train. (descendre)

Antwoorden:
`vont` · `attendent` · `descendent`

### T3-REV-035 — Rendez-vous
— Tu es libre dimanche à 14 heures ?  
— Oui, ça va pour moi.  
— Parfait ! On se retrouve devant ___ bibliothèque.  
— D’accord. Je viens ___ centre-ville à vélo.

Antwoorden:
`la` · `du`

---

# 18. UI-regels Trajet 3

## Vocabulaire
Twee hoofdvormen:
- Traduire / Vertalen
- En contexte / In een zin

## Verbes
Twee hoofdvormen:
- Conjuguer / Vervoegen
- Dans une phrase / In een zin

Binnen Verbes kunnen kleine labels tonen:
- `aller`
- `famille de venir`
- `verbes en -RE`

Geen drie aparte hoofdtegels nodig.

## Nombres
Aparte tegel:
**De 0 à 79**

Geen masterypercentage per theoretische variant; denominator = bestaande 80 number-items.

## Grammaire
Hoofdkeuzes:
- `à → au / à la / à l’ / aux`
- `de → du / de la / de l’ / des`
- `En contexte / Gemengd`

De vaste constructies `penser à`, `téléphoner à`, `demander à`, `rêver de`, `à côté de`, enz. worden in context geïntegreerd, geen overdaad aan tegels.

---

# 19. Technische implementatieregels voor Codex

1. Gebruik de bestaande permanente course-item-ID’s.
2. Verander de 235 bestaande T3-items niet qua ID.
3. Nieuwe variant-ID’s uit dit document zijn geen mastery-items.
4. Toon Kiosque en Comment dire ? niet als actieve oefenmodule.
5. Behoud de 2 sound_rule-items in de data.
6. Vocab-contextvarianten mappen naar bestaande vocabulary-items.
7. Actes-varianten mappen naar de bestaande phrase-items.
8. Werkwoordcontext:
   - infinitiefkennis → bestaande verb-item;
   - conjugatie-evidence → passend conjugatiegoal.
9. Balanceer werkwoordselectie over persoonsgroepen én families.
10. Nombres:
    - denominator = 80;
    - 70–79 primaire Belgische vorm;
    - Franse 70–79-vormen accepted answers.
11. Grammarvarianten mappen op de 16 bestaande grammar_rule-items.
12. Bij vragen met meerdere gaten: per gat scoren/evidence.
13. Volledige vertaalzinnen: geen blanket negatieve evidence bij één fout.
14. Geen automatische AI-zingeneratie.
15. Randomisatie kiest alleen uit goedgekeurde varianten.
16. Respecteer bestaande rounds/task/mastery-architectuur.
17. Corrigeer de datasetcue bij `Pourquoi ne pas jouer au padel ?`:
    - fout: “Waarom niet gaan voetballen?”
    - correct: “Waarom niet gaan padellen?”

---

# 20. Kwaliteitscontrole — ronde 1: brongetrouwheid

Gecontroleerd:
- structuur volgt Trajet 3;
- woordenschat komt uit On se rappelle ? / On découvre !;
- Actes de parole volgen de bronformuleringen;
- 13 werkwoorddoelen exact uit de dataset;
- getallen exact 0–79;
- article contracté volledig: 8 contractievormen + 8 vaste constructies;
- geen nieuwe grammar topics toegevoegd;
- klankleer uitgesloten conform projectkeuze.

---

# 21. Kwaliteitscontrole — ronde 2: ambiguïteit/didactiek

Gecontroleerd en aangepast:
- geen vrije contexttarget voor `chouette/sympa/super`;
- geen vrije contexttarget voor `animé(e)/vivant(e)` wegens betekenisoverlap;
- geen vrije contexttarget voor `agréable/charmant/magnifique` wanneer meerdere antwoorden logisch zijn;
- plaatsrelaties testen niet tegelijk het kiezen van het voorzetsel én de contractie zonder context;
- verb-contextvragen tonen het infinitief;
- artikelvragen hebben één grammaticaal doel;
- volledige vertaalzinnen blijven op niveau van T1–T3.

---

# 22. Kwaliteitscontrole — ronde 3: dataconsistentie

Gecontroleerd:
- 235 permanente T3-items blijven het vaste fundament;
- 80 number-items blijven denominator;
- 16 grammar_rule-items blijven bestaan;
- 2 sound_rule-items worden niet verwijderd;
- variant-ID’s zijn alleen oefeningen;
- geen variant-ID mag dubbel voorkomen;
- multi-gap scoring is per gat;
- `aller` als vocabitem en als conjugatiegoal blijft logisch gescheiden;
- `rendre` en `rendre visite à` blijven afzonderlijke lexicale/conjugatie-items.

---

# 23. Gevonden bron-/datasetpunt

## Mismatch Actes de parole
Huidige dataset:
- NL: `Waarom niet gaan voetballen?`
- FR: `Pourquoi ne pas jouer au padel ?`

De Franse zin in de cursus gebruikt **padel**.
Voor Mon parcours corrigeren naar:
- NL: `Waarom niet gaan padellen?`
- FR: `Pourquoi ne pas jouer au padel ?`

Dit is een inhoudelijke datacorrectie; het permanente item-ID blijft ongewijzigd.

---

# 24. Status Trajet 3

Inhoudelijk uitgewerkt:
- Vocabulaire
- Expressions
- Proposer une activité
- Parler d’un village, d’une ville, d’une région
- Aller / venir-familie / verbes en -RE
- Nombres 0–79
- L’article contracté
- Révision intégrative

Bewust niet als digitale oefenbank:
- Kiosque — Alors, on danse ?
- Comment dire ? — Six, huit, dix, vingt

Trajet 3 is klaar om als contentbron voor Codex gebruikt te worden.


---

# SOURCE CONTENT — TRAJET 4

# Mon parcours — Trajet 4 Content Spec
Version: v1 — zelfstandig uitgewerkt en meermaals gecontroleerd
Bron: Univers français 1 — Trajet 4 + bestaand UF1 Trajet 4-bronpakket
Doel: inhoudelijke bron voor Codex. Codex mag de didactische inhoud niet zelf uitbreiden of herschrijven zonder expliciete instructie.

---

# 0. Algemene afspraken uit Trajet 1–3 blijven gelden

## 0.1 Permanente leeritems
De bestaande permanente course-items en item-ID’s blijven onaangeroerd.

Trajet 4 bevat in het huidige bronpakket exact **170 permanente items**:
- 78 vocabulary-items
- 49 phrase-items / Actes de parole
- 3 verb-items
- 37 grammar_rule-items
  - 10 binnen Atelier Verbes
  - 27 binnen Atelier Grammaire
- 2 sound_rule-items
- 1 dynamisch number_spec-item voor 0–100

Nieuwe oefenvarianten hieronder zijn **geen nieuwe permanente mastery-items**.

## 0.2 Oefenmodi
- **Apprendre / Leren**
  - begeleid;
  - korte regel of micro-uitleg;
  - na een fout gerichte feedback;
  - geen onafhankelijke mastery-evidence.
- **S’entraîner / Oefenen**
  - zelfstandig;
  - geen antwoord vooraf;
  - gerichte hint pas na fout;
  - onafhankelijke evidence.
- **Se tester / Test jezelf**
  - geen hints tijdens de reeks;
  - feedback op het einde;
  - onafhankelijke evidence.

## 0.3 Antwoordregels
- Accenten strikt.
- Rechte `'` en typografische `’` gelijkwaardig.
- Beginhoofdletter niet doorslaggevend.
- Eindpunt niet doorslaggevend.
- Expliciete `accepted_answers` alleen bij echte equivalenten.
- Geen brede fuzzy/AI-correctie.
- Bij bijna-correcte spelling mag een gerichte hint verschijnen.
- Open contextvragen alleen opnemen als de target voldoende eenduidig is.

## 0.4 Ambiguity rule
Voor elke vrije contextvraag:
> Als een ander actief leerwoord uit dezelfde scope logisch in hetzelfde gat past, herschrijf of schrap de vraag.

Liever géén contextoefening dan een dubbelzinnige contextoefening.

## 0.5 Mastery
- Oefenvarianten mappen naar bestaande leerdoelen.
- Geen nieuwe permanente doelen.
- Meer-gatenvragen: elk gat apart beoordelen en evidence registreren.
- Volledige vertaalzin:
  - volledig correct → positieve evidence voor gekoppelde doelen;
  - fout → integratieve vraag fout, maar niet automatisch alle gekoppelde doelen negatief bestraffen.

---

# 1. Scope Trajet 4

## Wel digitaal oefenen
1. **Atelier Parole — Dire comment on se déplace / De petits problèmes dans le trafic**
   - Traduire / Vertalen
   - En contexte / In een zin
   - transportmiddelen
   - Expressions / Actes de parole
2. **Atelier Verbes — Le futur proche et le passé récent / prendre, mettre et faire**
   - futur proche
   - passé récent
   - prendre / comprendre / apprendre / surprendre
   - mettre / promettre / permettre / admettre
   - faire
3. **Chiffres et lettres — De 0 à 100**
   - dynamische getaltraining
4. **Atelier Grammaire — Le féminin et le pluriel de l’adjectif**
   - algemene regels
   - productieve speciale vormen
   - uitzonderingen uit de cursus
   - gemengde toepassing
5. **Révision du trajet 4**
   - integratie van vocabulaire, Actes, werkwoorden, tijden, getallen en adjectieven

## Niet als aparte digitale module
- **Kiosque — Page poésie**
- **Comment dire ? — Le son [s] et [z]**: geen audiomodule
- **Puissance 4**: spelvorm uit het boek, geen masterybank
- **Les verbes et les articles — Bonne mémoire ?**: bron voor integratieve herhaling, geen nieuw permanent inhoudsblok

De bestaande 2 sound_rule-items blijven in de data bestaan maar worden niet actief aangeboden.

---

# 2. Atelier Parole — broninventaris

## 2.1 On se rappelle ?
### Substantifs
- le centre(-ville)
- le kilomètre
- la minute
- la rue

### Verbes
- faire
- habiter
- rentrer
- trouver
- venir (de)

### Adjectif
- quel / quelle

### Mots invariables
- à côté (de)
- beaucoup (de)
- comment
- entre
- ici
- (juste) en face (de)
- loin (de)
- maintenant
- souvent
- toujours
- (tout) près (de)

### Expressions
- C’est à Bruges.
- D’accord.
- Génial !
- Je vais à la piscine.
- Je vais chez ma tante.

### Ce n’est pas la même chose
- la station de métro / de tram
- la gare

## 2.2 On découvre !
### Substantifs
- l’accident
- l’arrêt
- la banlieue
- le bouchon
- le moyen de transport
- le parking
- le problème
- le quartier
- le ring
- le trafic

### Verbes
- avancer
- descendre
- se déplacer

### Adjectifs
- dangereux / dangereuse
- difficile
- parfait(e)
- prochain(e)
- rapide

### Mots invariables
- assez
- d’habitude
- en direction de
- exactement
- normalement

### Expressions
- avoir un pneu crevé
- dommage
- être à temps
- être en panne
- être en retard
- J’ai raté le bus.
- Ma batterie est à plat.
- Ma chaîne est tombée.
- Pas du tout.
- Top !
- Tu n’y peux rien.
- Zut !

### Moyens de transport
- à pied
- à roller
- à moto
- à vélo
- à scooter
- à trottinette (électrique)
- en skate(board)
- en avion
- en bateau
- en bus
- en métro
- en taxi
- en tram
- en train
- en voiture

---

# 3. Vocabulaire — oefenarchitectuur

## 3.1 Traduire / Vertalen
Bestaande directe vertaalvorm behouden.

### Richtingsregels
Bij phrases/expressions kan de directe vertaalmodus strikt op het doelitem beoordelen.
Communicatief gelijkwaardige reacties worden pas breed geaccepteerd in een **Actes de parole-situatie**, niet automatisch in directe vertaling.

Voorbeeld:
- target `Chouette !` in Traduire → primair `Chouette !`
- situationele positieve reactie → `Chouette !`, `Super !`, `Top !`, `Génial !` kunnen allemaal correct zijn

Dit voorkomt dat mastery van één phrase-item vervaagt door communicatieve synoniemen.

## 3.2 En contexte / In een zin
- Franse context;
- geen Nederlandse target tussen haakjes;
- artikel of voorzetsel mag al zichtbaar zijn als het lexicale doel elders ligt;
- context moet één target afdwingen;
- verbogen vorm mag terugmappen naar het basisitem.

---

# 4. Vocabulaire — En contexte bank

## 4.1 On se rappelle ?

| ID | Prompt | Antwoord |
|---|---|---|
| T4-VOC-CTX-001 | J’habite au ___, près de tous les magasins. | centre |
| T4-VOC-CTX-002 | Ma maison est à deux ___ de l’école. | kilomètres |
| T4-VOC-CTX-003 | Le bus arrive dans cinq ___. | minutes |
| T4-VOC-CTX-004 | J’habite dans la ___ de Bruxelles. | rue |
| T4-VOC-CTX-005 | Je ne reste pas ici : je vais ___ à la maison. | rentrer |
| T4-VOC-CTX-006 | Je cherche la gare mais je ne la ___. | trouve |
| T4-VOC-CTX-007 | Je ___ de la piscine. | viens |
| T4-VOC-CTX-008 | La banque est juste ___ la poste. | à côté de |
| T4-VOC-CTX-009 | Il y a ___ de voitures sur le ring. | beaucoup |
| T4-VOC-CTX-010 | La gare est ___ l’école et le parc. | entre |
| T4-VOC-CTX-011 | Je suis ___, devant l’école. | ici |
| T4-VOC-CTX-012 | La pharmacie est juste ___ du supermarché. | en face |
| T4-VOC-CTX-013 | Mon école est à vingt kilomètres : elle est ___ de chez moi. | loin |
| T4-VOC-CTX-014 | Avant, j’étais à l’école. ___, je suis à la maison. | Maintenant |
| T4-VOC-CTX-015 | Je prends le bus presque tous les jours. Je vais ___ en bus. | souvent |
| T4-VOC-CTX-016 | Je prends le métro chaque jour. Je vais ___ en métro. | toujours |
| T4-VOC-CTX-017 | La boulangerie est à une minute. Elle est tout ___ d’ici. | près |
| T4-VOC-CTX-018 | Je prends le métro à la ___ de métro. | station |
| T4-VOC-CTX-019 | Je prends le train à la ___. | gare |

Geen vrije contextvraag voor `comment` of `quel(le)` zonder extra grammaticale doelstelling; die worden in Actes de parole geoefend.

## 4.2 On découvre ! — trafic

| ID | Prompt | Antwoord |
|---|---|---|
| T4-VOC-CTX-020 | Deux voitures se touchent sur la route : il y a un ___. | accident |
| T4-VOC-CTX-021 | Je descends du bus à l’___ Botanique. | arrêt |
| T4-VOC-CTX-022 | Nous n’habitons pas dans le centre mais dans la ___. | banlieue |
| T4-VOC-CTX-023 | Les voitures n’avancent presque plus : il y a un ___. | bouchon |
| T4-VOC-CTX-024 | Le train est un ___ de transport. | moyen |
| T4-VOC-CTX-025 | Je laisse ma voiture sur le ___. | parking |
| T4-VOC-CTX-026 | Mon vélo est cassé. J’ai un ___. | problème |
| T4-VOC-CTX-027 | Sara et Thomas habitent dans le même ___. | quartier |
| T4-VOC-CTX-028 | Il y a un bouchon sur le ___ d’Anvers. | ring |
| T4-VOC-CTX-029 | Il y a beaucoup de voitures : le ___ est très dense. | trafic |
| T4-VOC-CTX-030 | Le feu passe au vert. Les voitures peuvent ___. | avancer |
| T4-VOC-CTX-031 | Je suis dans le bus. À la prochaine halte, je vais ___. | descendre |
| T4-VOC-CTX-032 | À Paris, on peut ___ en métro, en bus ou à vélo. | se déplacer |
| T4-VOC-CTX-033 | Rouler très vite en ville, c’est ___. | dangereux |
| T4-VOC-CTX-034 | Cette adresse est très ___ à trouver. | difficile |
| T4-VOC-CTX-035 | Le train part dans dix minutes : c’est ___. | parfait |
| T4-VOC-CTX-036 | J’ai raté ce bus. Je prends le ___ bus. | prochain |
| T4-VOC-CTX-037 | Le train fait le trajet très vite. Il est ___. | rapide |
| T4-VOC-CTX-038 | La gare n’est pas très loin, mais elle est ___ loin. | assez |
| T4-VOC-CTX-039 | Tous les jours, je vais à pied, mais aujourd’hui je prends le bus. ___, je vais à pied. | D’habitude |
| T4-VOC-CTX-040 | Ce bus va vers l’aéroport. Il va en ___ de l’aéroport. | direction |
| T4-VOC-CTX-041 | — Tu habites où ___ ? — Dans la rue de Bruges. | exactement |
| T4-VOC-CTX-042 | En général, je vais à vélo. ___, je vais à vélo. | Normalement |

## 4.3 Problèmes — expressions

| ID | Prompt | Antwoord |
|---|---|---|
| T4-VOC-CTX-043 | Mon pneu n’a plus d’air. J’___. | ai un pneu crevé |
| T4-VOC-CTX-044 | Je voulais venir, mais je ne peux pas. — Oh, ___. | dommage |
| T4-VOC-CTX-045 | Le train part à 8 h 00 et j’arrive à 7 h 55. Je suis ___. | à temps |
| T4-VOC-CTX-046 | Ma moto ne fonctionne plus. Elle est ___. | en panne |
| T4-VOC-CTX-047 | Le cours commence à huit heures et j’arrive à huit heures dix. Je suis ___. | en retard |
| T4-VOC-CTX-048 | Le bus est parti avant mon arrivée. J’___. | ai raté le bus |
| T4-VOC-CTX-049 | Mon téléphone est à 0 %. Ma ___. | batterie est à plat |
| T4-VOC-CTX-050 | Je pédale mais la chaîne n’est plus sur le vélo. Ma ___. | chaîne est tombée |
| T4-VOC-CTX-051 | — Tu es près de la gare ? — Non, ___. | pas du tout |
| T4-VOC-CTX-052 | C’est une excellente idée. — ___ ! | Top |
| T4-VOC-CTX-053 | Le train est supprimé à cause d’un accident. Ce n’est pas ta faute : ___. | tu n’y peux rien |
| T4-VOC-CTX-054 | J’ai encore raté le bus. ___ ! | Zut |

## 4.4 Moyens de transport — contextbank

| ID | Prompt | Antwoord |
|---|---|---|
| T4-TRSP-CTX-001 | Je marche jusqu’à l’école. J’y vais ___. | à pied |
| T4-TRSP-CTX-002 | J’ai des rollers aux pieds. Je vais au parc ___. | à roller |
| T4-TRSP-CTX-003 | Je conduis une moto. Je vais au travail ___. | à moto |
| T4-TRSP-CTX-004 | Je pédale jusqu’à l’école. J’y vais ___. | à vélo |
| T4-TRSP-CTX-005 | Je conduis un scooter. Je me déplace ___. | à scooter |
| T4-TRSP-CTX-006 | Je roule sur une trottinette électrique. Je vais au centre ___. | à trottinette électrique |
| T4-TRSP-CTX-007 | Je roule sur mon skateboard. Je vais au parc ___. | en skateboard |
| T4-TRSP-CTX-008 | Je prends l’avion pour aller en Espagne. J’y vais ___. | en avion |
| T4-TRSP-CTX-009 | Nous traversons le lac avec un bateau. Nous y allons ___. | en bateau |
| T4-TRSP-CTX-010 | Je monte dans le bus. Je vais à l’école ___. | en bus |
| T4-TRSP-CTX-011 | Je prends le métro à la station. Je vais au centre ___. | en métro |
| T4-TRSP-CTX-012 | Je monte dans un taxi. Je vais à l’hôtel ___. | en taxi |
| T4-TRSP-CTX-013 | Je prends le tram numéro 4. Je vais au centre ___. | en tram |
| T4-TRSP-CTX-014 | Je prends le train à la gare. Je vais à Bruxelles ___. | en train |
| T4-TRSP-CTX-015 | Mon père conduit. Nous allons à Lille ___. | en voiture |

Regel:
- de volledige transportuitdrukking is het target;
- `à` versus `en` is hier ingebed in het vocabulary-item, niet als nieuw grammar mastery-item.

---

# 5. Actes de parole — Dire comment on se déplace

De 49 bestaande phrase-items blijven de permanente targets.
De onderstaande varianten zijn alleen situationele oefenvormen.

| ID | Situatie | Verwacht antwoord |
|---|---|---|
| T4-ACT-MOVE-001 | Vraag iemand hoe hij/zij naar school gaat. | Tu vas à l’école comment ? |
| T4-ACT-MOVE-002 | Zeg: Gewoonlijk ga ik te voet. | D’habitude, je vais à pied. |
| T4-ACT-MOVE-003 | Zeg: Normaal gezien ga ik met de fiets. | Normalement, je vais à vélo. |
| T4-ACT-MOVE-004 | Zeg waar je woont: in de wijk. | Dans le quartier. |
| T4-ACT-MOVE-005 | Zeg waar je woont: in het centrum. | Dans le centre. |
| T4-ACT-MOVE-006 | Zeg waar je woont: in de buitenwijk. | Dans la banlieue. |
| T4-ACT-MOVE-007 | Zeg: Tegenover de sportzaal. | En face de la salle de sport. |
| T4-ACT-MOVE-008 | Reageer: Nee, het is heel dichtbij. | Non, c’est tout près. |
| T4-ACT-MOVE-009 | Zeg: Het is niet ver. | Ce n’est pas loin. |
| T4-ACT-MOVE-010 | Zeg: Het is vijftien minuten te voet. | C’est à quinze minutes à pied. |
| T4-ACT-MOVE-011 | Zeg: Het is twee kilometer. | C’est à deux kilomètres. |
| T4-ACT-MOVE-012 | Zeg: Ja, het is vrij ver. | Oui, c’est assez loin. |
| T4-ACT-MOVE-013 | Zeg: Het is moeilijk te vinden. | C’est difficile à trouver. |
| T4-ACT-MOVE-014 | Zeg: Ik ga vaak met de bus. | Je vais souvent en bus. |
| T4-ACT-MOVE-015 | Vraag: En jij, hoe ga jij erheen? | Et toi, tu y vas comment ? |
| T4-ACT-MOVE-016 | Vraag precies waar iemand woont. | Tu habites où exactement ? |
| T4-ACT-MOVE-017 | Vraag: Is het ver van hier? | C’est loin d’ici ? |
| T4-ACT-MOVE-018 | Reageer positief: Leuk!/Top! | Chouette ! / Super ! / Top ! / Génial ! |
| T4-ACT-MOVE-019 | Reageer meelevend: Jammer. | Dommage. / Pas de chance. |
| T4-ACT-MOVE-020 | Zeg: Je kunt er niets aan doen. | Tu n’y peux rien. |

### Accepted answers in Actes
Bij T4-ACT-MOVE-018 en 019 mogen de bronvarianten als communicatieve equivalenten worden geaccepteerd.
Bij directe vertaling van een specifiek phrase-item blijft scoring strikter.

---

# 6. Actes de parole — De petits problèmes dans le trafic

| ID | Situatie | Verwacht antwoord |
|---|---|---|
| T4-ACT-TRAF-001 | Vraag: Hoe gaat het? | Comment ça va ? |
| T4-ACT-TRAF-002 | Vraag: Wat is het probleem? | Quel est le problème ? / Tu as un problème ? / Qu’est-ce qu’il y a ? |
| T4-ACT-TRAF-003 | Reageer: Niet zo goed. | Pas très bien. |
| T4-ACT-TRAF-004 | Zeg: Ik heb een lekke band. | J’ai un pneu crevé. |
| T4-ACT-TRAF-005 | Zeg: Mijn motor is stuk. | Ma moto est en panne. |
| T4-ACT-TRAF-006 | Zeg: Er is een file op de ring. | Il y a un bouchon sur le ring. |
| T4-ACT-TRAF-007 | Zeg: Er is een ongeval op de ring. | Il y a un accident sur le ring. |
| T4-ACT-TRAF-008 | Zeg: Mijn ketting is eraf. | Ma chaîne est tombée. |
| T4-ACT-TRAF-009 | Zeg: De bus is te laat. | Le bus est en retard. |
| T4-ACT-TRAF-010 | Zeg: Mijn batterij is plat. | Ma batterie est à plat. |
| T4-ACT-TRAF-011 | Zeg: Ik heb de bus gemist. | J’ai raté le bus. |
| T4-ACT-TRAF-012 | Vraag: Waar ben je nu? | Tu es où maintenant ? |
| T4-ACT-TRAF-013 | Zeg: Ik ben vlak bij de apotheek. | Je suis tout près de la pharmacie. |
| T4-ACT-TRAF-014 | Zeg: Ik ben in het centrum, niet ver van de supermarkt. | Je suis dans le centre, pas loin du supermarché. |
| T4-ACT-TRAF-015 | Stel voor: Waarom neem je de bus niet? | Et pourquoi ne pas prendre le bus ? |
| T4-ACT-TRAF-016 | Stel voor: Waarom ga je niet te voet? | Et pourquoi ne pas aller à pied ? |
| T4-ACT-TRAF-017 | Stel voor: Waarom wacht je niet op de volgende tram? | Et pourquoi ne pas attendre le prochain tram ? |
| T4-ACT-TRAF-018 | Zeg: De bus in de richting van de luchthaven. | Le bus en direction de l’aéroport. |
| T4-ACT-TRAF-019 | Zeg: Je stapt uit aan de halte Zaventem. | Tu descends à l’arrêt Zaventem. |
| T4-ACT-TRAF-020 | Vraag: Welke bus neem ik? | Je prends quel bus ? |
| T4-ACT-TRAF-021 | Vraag: Welke richting neem ik? | Je prends quelle direction ? |
| T4-ACT-TRAF-022 | Reageer: Goed idee. | Bonne idée. |
| T4-ACT-TRAF-023 | Reageer: Goed plan. | Bon plan. |
| T4-ACT-TRAF-024 | Reageer akkoord. | D’accord. / Parfait. / O.K. Merci. |

### Datakwaliteit
Het bestaande phrase-item `Pas très bien.` heeft in het bronpakket ook `Non, pas du tout.` als accepted answer.
Dat is als directe vertaling van **“Niet zo goed.”** te ruim.
Implementatie:
- bij directe phrase-training: `Pas très bien.` als doel;
- in een vrije reactie op `Comment ça va ?` kan `Non, pas du tout.` als communicatief alternatief worden toegelaten als de context dat ondersteunt.

---

# 7. Atelier Verbes — permanente doelen

## 7.1 Tijden
Vier bestaande grammar_rule-items:
- vorming futur proche
- gebruik futur proche
- vorming passé récent
- gebruik passé récent

## 7.2 Kernwerkwoorden
Drie bestaande verb-items:
- prendre
- mettre
- faire

## 7.3 Zelfde vervoeging
Zes bestaande grammar_rule-items:
### Familie prendre
- comprendre
- apprendre
- surprendre

### Familie mettre
- promettre
- permettre
- admettre

Deze blijven hun bestaande permanente itemtype houden.
De oefenbank mag ze wel als concrete conjugatiedoelen gebruiken en evidence naar het corresponderende bestaande grammar_rule-item sturen.

---

# 8. Le futur proche

## 8.1 Kernregel
**indicatif présent van aller + infinitif**

Gebruik:
iets dat in de nabije toekomst gaat gebeuren.

## 8.2 Apprendre — micro-uitleg
Voorbeeld:
`Je vais regarder un film.`

Benadruk:
- alleen `aller` wordt vervoegd;
- het tweede werkwoord blijft infinitief.

## 8.3 Contextbank

| ID | Vraag | Antwoord |
|---|---|---|
| T4-FP-001 | Ce soir, je ___ un film. (regarder) | vais regarder |
| T4-FP-002 | Dans une heure, tu ___ au tennis. (jouer) | vas jouer |
| T4-FP-003 | À midi, Lucas ___ des frites. (manger) | va manger |
| T4-FP-004 | Cet après-midi, Emma ___ son grand-père. (aider) | va aider |
| T4-FP-005 | Demain, nous ___ des photos. (prendre) | allons prendre |
| T4-FP-006 | Ce week-end, vous ___ chez papi. (loger) | allez loger |
| T4-FP-007 | Samedi, ils ___ le musée. (visiter) | vont visiter |
| T4-FP-008 | Après le cours, elles ___ en bus. (rentrer) | vont rentrer |
| T4-FP-009 | Dans dix minutes, je ___ le train. (prendre) | vais prendre |
| T4-FP-010 | Demain matin, tu ___ ta veste. (mettre) | vas mettre |
| T4-FP-011 | À 18 h, on ___ du vélo. (faire) | va faire |
| T4-FP-012 | Cet été, nous ___ en France. (partir) | allons partir |
| T4-FP-013 | Tout à l’heure, vous ___ au professeur. (répondre) | allez répondre |
| T4-FP-014 | Ce soir, Lucas et Emma ___ leurs devoirs. (finir) | vont finir |
| T4-FP-015 | Demain, ma sœur ___ un livre. (lire) | va lire |
| T4-FP-016 | Dans une heure, mes amis ___ à la piscine. (venir) | vont venir |
| T4-FP-017 | Après le dîner, je ___ mon sac. (préparer) | vais préparer |
| T4-FP-018 | Samedi, nous ___ au centre commercial. (aller) | allons aller |
| T4-FP-019 | Ce soir, elle ___ de la musique. (écouter) | va écouter |
| T4-FP-020 | Demain, ils ___ un dessert. (choisir) | vont choisir |

### Opmerking over `aller + aller`
`Nous allons aller ...` is grammaticaal correct en didactisch nuttig, maar kan vreemd aanvoelen.
Niet oververtegenwoordigen; één voorbeeld volstaat.

---

# 9. Le passé récent

## 9.1 Kernregel
**indicatif présent van venir + de / d’ + infinitif**

Gebruik:
iets dat pas / zopas / zojuist / zonet gebeurd is.

## 9.2 Apprendre — micro-uitleg
- `venir` wordt vervoegd;
- daarna `de` + infinitief;
- vóór een klinker: `d’`.

Voorbeeld:
`Je viens de regarder un film.`

## 9.3 Contextbank

| ID | Vraag | Antwoord |
|---|---|---|
| T4-PR-001 | Il y a une minute, je ___ un film. (regarder) | viens de regarder |
| T4-PR-002 | Tu arrives de la piscine : tu ___ une heure. (nager) | viens de nager |
| T4-PR-003 | Lucas a son sac en main : il ___ ses affaires. (ranger) | vient de ranger |
| T4-PR-004 | Emma sort du restaurant : elle ___ des frites. (manger) | vient de manger |
| T4-PR-005 | Nous sortons du magasin : nous ___ une veste. (acheter) | venons d’acheter |
| T4-PR-006 | Vous avez les photos en main : vous ___ des photos. (prendre) | venez de prendre |
| T4-PR-007 | Ils quittent le musée : ils ___ le musée. (visiter) | viennent de visiter |
| T4-PR-008 | Elles arrivent chez elles : elles ___ de l’école. (rentrer) | viennent de rentrer |
| T4-PR-009 | Je suis devant mamie : je ___ chez elle. (arriver) | viens d’arriver |
| T4-PR-010 | Tu poses ton téléphone : tu ___ à mamie. (téléphoner) | viens de téléphoner |
| T4-PR-011 | On quitte la salle : on ___ du sport. (faire) | vient de faire |
| T4-PR-012 | Nous avons le livre : nous ___ le livre. (finir) | venons de finir |
| T4-PR-013 | Vous avez la réponse : vous ___ à la question. (répondre) | venez de répondre |
| T4-PR-014 | Lucas et Emma sortent du bus : ils ___ du bus. (descendre) | viennent de descendre |
| T4-PR-015 | Elle a sa nouvelle robe : elle ___ sa robe. (mettre) | vient de mettre |
| T4-PR-016 | Mes amis connaissent la nouvelle : ils ___ la nouvelle. (apprendre) | viennent d’apprendre |
| T4-PR-017 | Je suis surpris : je ___ une bonne nouvelle. (apprendre) | viens d’apprendre |
| T4-PR-018 | Nous sommes à table : nous ___ le repas. (préparer) | venons de préparer |
| T4-PR-019 | Le train est parti : il ___ de partir. (partir) | vient de partir |
| T4-PR-020 | Ils ont faim : ils ___ de courir. (finir) | viennent de finir |

Correctie T4-PR-020:
de context `ils ont faim` is geen eenduidige aanwijzing voor `finir`.
Gebruik deze variant **niet** in de definitieve data.
Vervang door:
`Le cours est terminé : ils viennent de finir le cours.`

Definitieve targetzin:
`Le cours est terminé : ils ___ le cours. (finir) → viennent de finir`

---

# 10. Présent — prendre / mettre / faire en families

## 10.1 Prendre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-001 | 1 | Je ___ le bus. (prendre) | prends |
| T4-VERB-CTX-002 | 2 | Emma ___ le train. (prendre) | prend |
| T4-VERB-CTX-003 | 3 | Lucas et moi ___ des photos. (prendre) | prenons |

## 10.2 Comprendre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-004 | 1 | Tu ___ la question. (comprendre) | comprends |
| T4-VERB-CTX-005 | 2 | Sarah ___ le texte. (comprendre) | comprend |
| T4-VERB-CTX-006 | 3 | Les élèves ___ le problème. (comprendre) | comprennent |

## 10.3 Apprendre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-007 | 1 | Nous ___ les nouveaux mots. (apprendre) | apprenons |
| T4-VERB-CTX-008 | 2 | Mon frère ___ le français. (apprendre) | apprend |
| T4-VERB-CTX-009 | 3 | Emma et Sarah ___ une chanson. (apprendre) | apprennent |

## 10.4 Surprendre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-010 | 1 | Je ___ mon frère avec un cadeau. (surprendre) | surprends |
| T4-VERB-CTX-011 | 2 | La nouvelle ___ Lucas. (surprendre) | surprend |
| T4-VERB-CTX-012 | 3 | Les résultats ___ les élèves. (surprendre) | surprennent |

## 10.5 Mettre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-013 | 1 | Tu ___ ta veste. (mettre) | mets |
| T4-VERB-CTX-014 | 2 | Emma ___ son sac sur la table. (mettre) | met |
| T4-VERB-CTX-015 | 3 | Nous ___ nos chaussures. (mettre) | mettons |

## 10.6 Promettre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-016 | 1 | Je ___ d’être à temps. (promettre) | promets |
| T4-VERB-CTX-017 | 2 | Lucas ___ de revenir. (promettre) | promet |
| T4-VERB-CTX-018 | 3 | Mes parents ___ de venir. (promettre) | promettent |

## 10.7 Permettre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-019 | 1 | Vous ___ les GSM en classe ? (permettre) | permettez |
| T4-VERB-CTX-020 | 2 | Le professeur ___ une pause. (permettre) | permet |
| T4-VERB-CTX-021 | 3 | Mes parents ___ cette sortie. (permettre) | permettent |

## 10.8 Admettre

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-022 | 1 | J’___ mon erreur. (admettre) | admets |
| T4-VERB-CTX-023 | 2 | Emma ___ sa faute. (admettre) | admet |
| T4-VERB-CTX-024 | 3 | Ils ___ le problème. (admettre) | admettent |

## 10.9 Faire

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T4-VERB-CTX-025 | 1 | Je ___ du vélo. (faire) | fais |
| T4-VERB-CTX-026 | 2 | Lucas ___ un dessin. (faire) | fait |
| T4-VERB-CTX-027 | 3 | Emma et moi ___ une promenade. (faire) | faisons |

### Mapping
- `prendre`, `mettre`, `faire` → hun bestaande verb-items
- `comprendre`, `apprendre`, `surprendre`, `promettre`, `permettre`, `admettre` → corresponderende bestaande grammar_rule-items “même conjugaison”
- geen nieuwe permanente verb-items aanmaken

---

# 11. Tijden gemengd — FP / PR / présent

| ID | Vraag | Antwoord |
|---|---|---|
| T4-TENSE-MIX-001 | Demain, je ___ le métro. (prendre) | vais prendre |
| T4-TENSE-MIX-002 | Il y a une minute, je ___ le métro. (prendre) | viens de prendre |
| T4-TENSE-MIX-003 | Chaque jour, je ___ le métro. (prendre) | prends |
| T4-TENSE-MIX-004 | Ce soir, Emma ___ sa veste. (mettre) | va mettre |
| T4-TENSE-MIX-005 | Emma est prête : elle ___ sa veste. (mettre) | vient de mettre |
| T4-TENSE-MIX-006 | Tous les matins, Emma ___ sa veste. (mettre) | met |
| T4-TENSE-MIX-007 | Demain, nous ___ du vélo. (faire) | allons faire |
| T4-TENSE-MIX-008 | Nous revenons du parc : nous ___ du vélo. (faire) | venons de faire |
| T4-TENSE-MIX-009 | Le dimanche, nous ___ du vélo. (faire) | faisons |
| T4-TENSE-MIX-010 | Dans une heure, ils ___ leurs devoirs. (finir) | vont finir |
| T4-TENSE-MIX-011 | Leurs devoirs sont terminés : ils ___ leurs devoirs. (finir) | viennent de finir |
| T4-TENSE-MIX-012 | Normalement, ils ___ leurs devoirs à 18 h. (finir) | finissent |

Selectie:
- mix van présent / futur proche / passé récent alleen wanneer de tijdscontext eenduidig is;
- in `Se tester` mag het label van de tijd verdwijnen als de context voldoende duidelijk is.

---

# 12. Chiffres et lettres — De 0 à 100

## 12.1 Permanente mastery
Er is **één bestaand number_spec-item** voor het bereik 0–100.
Maak **geen 101 nieuwe permanente number-items**.

## 12.2 Dynamische oefenvormen
### Chiffres → lettres
`83 → quatre-vingt-trois`

### Lettres → chiffres
`nonante-six → 96`

### Context
- leeftijden
- prijzen
- telefoonnummers per groep
- eenvoudige rekensommen
- aantallen

## 12.3 Primaire Belgische vormen
- 70 `septante`
- 71 `septante-et-un`
- …
- 79 `septante-neuf`
- 90 `nonante`
- 91 `nonante-et-un`
- …
- 99 `nonante-neuf`

## 12.4 Accepted regionale varianten
Accepteer ook de Franse vormen:
- 70 `soixante-dix`
- 71 `soixante-et-onze`
- …
- 79 `soixante-dix-neuf`
- 90 `quatre-vingt-dix`
- 91 `quatre-vingt-onze`
- …
- 99 `quatre-vingt-dix-neuf`

## 12.5 Belangrijke spelling
- 80 = `quatre-vingts`
- 81 = `quatre-vingt-un`
- 100 = `cent`

De `s` van `quatre-vingts` verdwijnt wanneer er nog een getal op volgt.

## 12.6 Sampling
Bij langere reeksen balanceer over:
- 0–20
- 21–69
- 70–79
- 80–89
- 90–100

Doel: niet toevallig alleen makkelijke tientallen tonen.

---

# 13. Atelier Grammaire — Le féminin et le pluriel de l’adjectif

## 13.1 Permanente grammar targets
### Féminin — algemene/productieve regels
1. masculin + e
2. adjectief eindigt al op -e → geen verandering
3. -x → -se
4. -f → -ve
5. -on → -onne
6. -eau → -elle
7. -er → -ère

### Pluriel
8. singulier + s
9. eindigt op -s → geen verandering
10. eindigt op -x → geen verandering
11. -eau → -eaux
12. -al → -aux

### Specifieke vrouwelijke vormen uit On découvre !
- court → courte
- petit → petite
- intelligent → intelligente
- dernier → dernière
- vieux → vieille
- long → longue
- nouveau → nouvelle
- sportif → sportive
- dangereux → dangereuse
- gros → grosse
- blanc → blanche
- chouette → chouette
- fou → folle
- gentil → gentille
- roux → rousse

---

# 14. Grammaire — féminin, basis

| ID | Vraag | Antwoord | Regel |
|---|---|---|---|
| T4-GRAM-FEM-001 | un garçon petit → une fille ___ | petite | +e |
| T4-GRAM-FEM-002 | un garçon intelligent → une fille ___ | intelligente | +e |
| T4-GRAM-FEM-003 | un garçon sportif → une fille ___ | sportive | -f → -ve |
| T4-GRAM-FEM-004 | un homme dangereux → une femme ___ | dangereuse | -x → -se |
| T4-GRAM-FEM-005 | un garçon mignon → une fille ___ | mignonne | -on → -onne |
| T4-GRAM-FEM-006 | un nouveau sac → une ___ voiture | nouvelle | -eau → -elle |
| T4-GRAM-FEM-007 | le premier jour → la ___ fois | première | -er → -ère |
| T4-GRAM-FEM-008 | un garçon calme → une fille ___ | calme | eindigt op -e |
| T4-GRAM-FEM-009 | un exercice difficile → une question ___ | difficile | eindigt op -e |
| T4-GRAM-FEM-010 | un groupe chouette → une activité ___ | chouette | eindigt op -e |

Microfeedback:
- toon de relevante eindverandering;
- niet enkel “fout”, maar bv. `sportif → sportive`.

---

# 15. Grammaire — specifieke vrouwelijke vormen

| ID | Vraag | Antwoord |
|---|---|---|
| T4-GRAM-EXC-001 | court → féminin | courte |
| T4-GRAM-EXC-002 | petit → féminin | petite |
| T4-GRAM-EXC-003 | intelligent → féminin | intelligente |
| T4-GRAM-EXC-004 | dernier → féminin | dernière |
| T4-GRAM-EXC-005 | vieux → féminin | vieille |
| T4-GRAM-EXC-006 | long → féminin | longue |
| T4-GRAM-EXC-007 | nouveau → féminin | nouvelle |
| T4-GRAM-EXC-008 | sportif → féminin | sportive |
| T4-GRAM-EXC-009 | dangereux → féminin | dangereuse |
| T4-GRAM-EXC-010 | gros → féminin | grosse |
| T4-GRAM-EXC-011 | blanc → féminin | blanche |
| T4-GRAM-EXC-012 | chouette → féminin | chouette |
| T4-GRAM-EXC-013 | fou → féminin | folle |
| T4-GRAM-EXC-014 | gentil → féminin | gentille |
| T4-GRAM-EXC-015 | roux → féminin | rousse |

In `Apprendre` mag deze tabel ondersteund worden.
In `S’entraîner` en `Se tester` liefst toepassing in een noun phrase/zinnetje, niet alleen kale omzettingen.

---

# 16. Grammaire — féminin in context

| ID | Vraag | Antwoord |
|---|---|---|
| T4-GRAM-FCTX-001 | Madame, vous avez une ___ adresse ? (nouveau) | nouvelle |
| T4-GRAM-FCTX-002 | Cette route est très ___. (dangereux) | dangereuse |
| T4-GRAM-FCTX-003 | Quelle ___ surprise ! (beau) | belle |
| T4-GRAM-FCTX-004 | Ma sœur est très ___. (sportif) | sportive |
| T4-GRAM-FCTX-005 | C’est une ___ dame. (vieux) | vieille |
| T4-GRAM-FCTX-006 | Emma porte une robe ___. (blanc) | blanche |
| T4-GRAM-FCTX-007 | Ma cousine est très ___. (gentil) | gentille |
| T4-GRAM-FCTX-008 | Elle a les cheveux ___. (roux) | roux |
| T4-GRAM-FCTX-009 | La route est très ___. (long) | longue |
| T4-GRAM-FCTX-010 | C’est la ___ activité de la journée. (dernier) | dernière |

Opmerking T4-GRAM-FCTX-008:
bij `les cheveux roux` bepaalt het mannelijk meervoud van `cheveux` de vorm.
Deze variant test géén féminin maar is nuttig in gemengde training; verplaats technisch naar de mixed bank.

---

# 17. Grammaire — pluriel

| ID | Vraag | Antwoord | Regel |
|---|---|---|---|
| T4-GRAM-PL-001 | un concert original → des concerts ___ | originaux | -al → -aux |
| T4-GRAM-PL-002 | un beau cadeau → de beaux ___ | cadeaux | -eau → -eaux |
| T4-GRAM-PL-003 | un chien gris → des chiens ___ | gris | -s onveranderd |
| T4-GRAM-PL-004 | un garçon amoureux → des garçons ___ | amoureux | -x onveranderd |
| T4-GRAM-PL-005 | une fille dangereuse → des filles ___ | dangereuses | +s |
| T4-GRAM-PL-006 | une voiture rapide → des voitures ___ | rapides | +s |
| T4-GRAM-PL-007 | un grand bâtiment → de grands ___ | bâtiments | +s |
| T4-GRAM-PL-008 | un nouveau château → de nouveaux ___ | châteaux | beide woorden meervoud |
| T4-GRAM-PL-009 | un vieux quartier → de vieux ___ | quartiers | adjectief -x onveranderd |
| T4-GRAM-PL-010 | une belle rue → de belles ___ | rues | +s |

Bij varianten met zowel substantief als adjectief:
- beoordeel alleen het expliciet gemarkeerde target als dit een grammarvariant is;
- vermijd onbedoelde dubbele straf voor een zelfstandig-naamwoordspelling.

---

# 18. Grammaire — gemengde adjectiefvormen

| ID | Vraag | Antwoord |
|---|---|---|
| T4-GRAM-MIX-001 | une ___ idée (bon) | bonne |
| T4-GRAM-MIX-002 | une rue ___ (court) | courte |
| T4-GRAM-MIX-003 | des femmes ___ (sportif) | sportives |
| T4-GRAM-MIX-004 | des cadeaux ___ (original) | originaux |
| T4-GRAM-MIX-005 | une dame ___ (gentil) | gentille |
| T4-GRAM-MIX-006 | des routes ___ (dangereux) | dangereuses |
| T4-GRAM-MIX-007 | une voiture ___ (blanc) | blanche |
| T4-GRAM-MIX-008 | des garçons ___ (roux) | roux |
| T4-GRAM-MIX-009 | une ___ jupe (nouveau) | nouvelle |
| T4-GRAM-MIX-010 | les ___ concerts (dernier) | derniers |
| T4-GRAM-MIX-011 | des filles ___ (intelligent) | intelligentes |
| T4-GRAM-MIX-012 | une journée ___ (long) | longue |
| T4-GRAM-MIX-013 | des hommes ___ (vieux) | vieux |
| T4-GRAM-MIX-014 | une idée ___ (fou) | folle |
| T4-GRAM-MIX-015 | de ___ cadeaux (beau) | beaux |
| T4-GRAM-MIX-016 | les cheveux ___ (roux) | roux |
| T4-GRAM-MIX-017 | une femme ___ (gros) | grosse |
| T4-GRAM-MIX-018 | des robes ___ (blanc) | blanches |
| T4-GRAM-MIX-019 | la ___ fois (premier) | première |
| T4-GRAM-MIX-020 | des groupes ___ (chouette) | chouettes |

Selectie moet spreiden over:
- mannelijk/vrouwelijk;
- enkelvoud/meervoud;
- regelmatige en speciale vormen.

---

# 19. Révision du trajet 4

Aparte tegel:
**Révision du trajet**
*Alles door elkaar*

Combineert:
- transport en verkeersproblemen;
- Actes de parole;
- futur proche;
- passé récent;
- prendre/mettre/faire + families;
- getallen 0–100;
- féminin/pluriel de l’adjectif;
- eerder gekende artikelen/negatie alleen waar de bron ze opnieuw gebruikt.

---

# 20. Révision — volledige zinnen NL → FR

| ID | Nederlands | Correct Frans |
|---|---|---|
| T4-REV-001 | Gewoonlijk ga ik met de fiets naar school. | D’habitude, je vais à l’école à vélo. |
| T4-REV-002 | Mijn broer gaat altijd met de metro. | Mon frère va toujours en métro. |
| T4-REV-003 | Ik heb een lekke band. | J’ai un pneu crevé. |
| T4-REV-004 | De bus is te laat. | Le bus est en retard. |
| T4-REV-005 | Ik heb de bus gemist. | J’ai raté le bus. |
| T4-REV-006 | Waarom neem je de volgende tram niet? | Pourquoi ne pas prendre le prochain tram ? |
| T4-REV-007 | Morgen ga ik de trein nemen. | Demain, je vais prendre le train. |
| T4-REV-008 | Ik heb zonet mijn jas aangetrokken. | Je viens de mettre ma veste. |
| T4-REV-009 | Wij begrijpen de vraag. | Nous comprenons la question. |
| T4-REV-010 | De leerlingen leren nieuwe woorden. | Les élèves apprennent de nouveaux mots. |
| T4-REV-011 | Ik beloof op tijd te zijn. | Je promets d’être à temps. |
| T4-REV-012 | Mijn ouders staan de uitstap toe. | Mes parents permettent la sortie. |
| T4-REV-013 | Dit is een gevaarlijke weg. | C’est une route dangereuse. |
| T4-REV-014 | Zij heeft een nieuwe witte auto. | Elle a une nouvelle voiture blanche. |
| T4-REV-015 | De laatste concerten zijn origineel. | Les derniers concerts sont originaux. |

---

# 21. Révision — gemengde invulzinnen

| ID | Vraag | Antwoord(en) |
|---|---|---|
| T4-REV-016 | Demain, nous ___ le bus. (prendre) | allons prendre |
| T4-REV-017 | Le bus vient de partir : je ___ le bus. | ai raté |
| T4-REV-018 | Emma ___ sa veste. (mettre, présent) | met |
| T4-REV-019 | Nous ___ les nouveaux mots. (apprendre) | apprenons |
| T4-REV-020 | Tu ___ d’être à temps. (promettre) | promets |
| T4-REV-021 | Cette route est ___. (dangereux) | dangereuse |
| T4-REV-022 | Une ___ voiture. (nouveau) | nouvelle |
| T4-REV-023 | Des cadeaux ___. (original) | originaux |
| T4-REV-024 | Les filles sont très ___. (sportif) | sportives |
| T4-REV-025 | Les garçons ont les cheveux ___. (roux) | roux |

---

# 22. Révision — nombres

| ID | Vraag | Antwoord |
|---|---|---|
| T4-REV-026 | Écris 79 en lettres. | septante-neuf |
| T4-REV-027 | Écris `nonante-six` en chiffres. | 96 |
| T4-REV-028 | Écris 80 en lettres. | quatre-vingts |
| T4-REV-029 | Écris 81 en lettres. | quatre-vingt-un |
| T4-REV-030 | Écris 100 en lettres. | cent |

Voor 70–79 en 90–99 regionale Franse varianten accepteren volgens §12.

---

# 23. Révision — mini-dialogen

### T4-REV-031 — Naar school
— Tu vas à l’école comment ?  
— D’habitude, j’y vais ___.  
— C’est loin ?  
— Non, c’est tout ___.

Antwoorden:
`à vélo` · `près`

### T4-REV-032 — Pech
— Salut, ça va ?  
— Pas très bien. J’___.  
— Oh, dommage. Tu es où ?  
— Je suis tout ___ de la pharmacie.

Antwoorden:
`ai un pneu crevé` · `près`

### T4-REV-033 — Bus gemist
— Pourquoi tu es en retard ?  
— J’___ le bus.  
— Et maintenant ?  
— Je ___ prendre le prochain bus. (futur proche)

Antwoorden:
`ai raté` · `vais`

De tweede target wordt technisch als volledige constructie beoordeeld:
`vais prendre`

### T4-REV-034 — Pas gebeurd / gaat gebeuren
Il est 14 h 00.  
À 13 h 55, Emma ___ son sac. (préparer, passé récent)  
À 14 h 10, elle ___ le bus. (prendre, futur proche)

Antwoorden:
`vient de préparer` · `va prendre`

### T4-REV-035 — Adjectifs
Emma a une ___ voiture. (nouveau)  
La voiture est ___. (blanc)  
Ses parents ont deux voitures ___. (original)

Antwoorden:
`nouvelle` · `blanche` · `originales`

---

# 24. UI-regels Trajet 4

## Vocabulaire
Twee hoofdvormen:
- Traduire / Vertalen
- En contexte / In een zin

Transportmiddelen zijn onderdeel van vocabulaire/context, geen extra hoofdnavigatie.

## Actes de parole
Binnen Atelier Parole twee visuele groepen:
- **Se déplacer / Zich verplaatsen**
- **Un problème / Een probleem**

Geen extra complexe navigatie.

## Verbes
Twee hoofdvormen:
- **Conjuguer / Vervoegen**
- **Dans une phrase / In een zin**

Daarnaast kleine filter/chips:
- Présent
- Futur proche
- Passé récent

Niet drie aparte grote modules.

## Nombres
Aparte tegel:
**De 0 à 100**

## Grammaire
Hoofdkeuzes:
- **Féminin**
- **Pluriel**
- **Mélange / Alles door elkaar**

De individuele eindigingsregels zijn didactische lagen binnen deze drie, geen 27 tegels.

---

# 25. Mapping- en implementatieregels voor Codex

1. Gebruik bestaande permanente item-ID’s uit `course.json`.
2. Verander de 170 bestaande T4-items niet qua ID.
3. Nieuwe variant-ID’s zijn oefenvarianten, geen course-items.
4. Kiosque, soundmodule en Puissance 4 niet als actieve oefenmodule tonen.
5. Behoud de 2 sound_rule-items in data.
6. Vocab-contextvarianten mappen naar bestaande vocabulary-items.
7. Phrase-/Actes-varianten mappen naar bestaande phrase-items.
8. `faire` bestaat als vocabulary-item én als verb-item; merge deze permanente IDs niet.
9. Futur proche/passé récent:
   - evidence voor vorming/gebruik naar de vier bestaande grammar_rule-items;
   - eventueel extra evidence naar het gebruikte werkwoorddoel indien dat een bestaand verb/conjugatiegoal is.
10. `prendre`, `mettre`, `faire` → bestaande verb-items.
11. `comprendre`, `apprendre`, `surprendre`, `promettre`, `permettre`, `admettre` → bestaande “même conjugaison”-grammar_rule-items.
12. Number range 0–100:
   - één bestaand number_spec-item;
   - geen 101 permanente items genereren.
13. Belgische vormen `septante/nonante` primair;
   regionale Franse vormen accepteren.
14. Adjectiefvarianten mappen op de 27 bestaande grammar_rule-items.
15. Multi-gap: elk gat apart beoordelen.
16. Volledige vertaalzinnen: geen blanket negative mastery bij één fout.
17. Randomisatie kiest alleen uit goedgekeurde statische banken plus de gecontroleerde number-generator.
18. Geen automatische AI-zingeneratie.
19. Respecteer bestaande rounds/task/mastery-architectuur.
20. Communicatieve accepted answers alleen breed toepassen in Actes-context; directe vertaling blijft target-specifiek.

---

# 26. Kwaliteitscontrole — ronde 1: brongetrouwheid

Gecontroleerd:
- 170 permanente items exact uit het bestaande T4-bronpakket;
- Atelier Parole volgt transport/verkeersproblemen;
- transportvoorzetsels `à`/`en` alleen geoefend via bestaande transportitems, geen nieuw grammar-target;
- futur proche en passé récent volgen exact de bronstructuur;
- `prendre`, `mettre`, `faire` en hun families volgens de cursustabellen;
- numbers dynamisch 0–100;
- féminin/pluriel exact volgens de 27 bestaande grammar_rule-items;
- soundmodule uitgesloten conform projectkeuze.

---

# 27. Kwaliteitscontrole — ronde 2: ambiguïteit/didactiek

Gecontroleerd en aangepast:
- geen open contextvragen waarin meerdere vervoersmiddelen even logisch zijn zonder concrete clue;
- `quel(le)` en `comment` niet als vrije vocab-gap geforceerd;
- communicatieve synoniemen niet automatisch als lexicale equivalenten behandelen;
- futur proche/passé récent hebben expliciete tijdscontext;
- passé récent gebruikt `d’` vóór klinker;
- derived verbs worden geoefend zonder nieuwe permanent IDs;
- adjective-contexten hebben duidelijk gender/number-signaal;
- mixed adjective bank spreidt over regelmatige en uitzonderingsvormen.

---

# 28. Kwaliteitscontrole — ronde 3: technische consistentie

Gecontroleerd:
- number_spec blijft één permanent item;
- sound_rule-items blijven behouden maar verborgen;
- `faire` vocab versus `faire` verb blijft gescheiden;
- phrase accepted answers worden contextafhankelijk behandeld;
- variant-ID’s zijn uniek;
- multi-gap scoring per gat;
- integratieve vertaling geeft geen blanket negatieve mastery;
- tijdelijke/dynamische numbervarianten vergroten mastery denominator niet.

---

# 29. Gevonden data-aandachtspunt

## `Pas très bien.` accepted answers
Bronpakket:
- target/NL: `Pas très bien.` / `Niet zo goed.`
- accepted bevat ook `Non, pas du tout.`

Dat laatste is een mogelijke reactie in het brondialoog, maar geen zuivere vertaling van “Niet zo goed”.

Aanpassing in Mon parcours:
- directe vertaling → primair `Pas très bien.`
- vrije gespreksreactie → alternatieven alleen toelaten wanneer de situationele prompt ze semantisch ondersteunt.

Het permanente item-ID blijft ongewijzigd.

---

# 30. Status Trajet 4

Inhoudelijk uitgewerkt:
- Vocabulaire
- Moyens de transport
- Dire comment on se déplace
- De petits problèmes dans le trafic
- Futur proche
- Passé récent
- Prendre / mettre / faire en families
- Nombres 0–100
- Féminin et pluriel de l’adjectif
- Révision intégrative

Bewust niet als aparte digitale oefenbank:
- Page poésie / Kiosque
- Le son [s] et [z]
- Puissance 4

Trajet 4 is klaar om als contentbron voor Codex gebruikt te worden.


---

# SOURCE CONTENT — TRAJET 5

# Mon parcours — Trajet 5 Content Spec
Version: v1 — zelfstandig uitgewerkt en meermaals gecontroleerd
Bron: Univers français 1 — Trajet 5 + bestaand UF1 Trajet 4–5–6-bronpakket
Doel: inhoudelijke bron voor Codex. Codex mag de didactische inhoud niet zelf uitbreiden of herschrijven zonder expliciete instructie.

---

# 0. Algemene afspraken uit Trajet 1–4 blijven gelden

## 0.1 Permanente leeritems
De bestaande permanente course-items en item-ID’s blijven onaangeroerd.

Trajet 5 bevat in het huidige bronpakket exact **144 permanente items**:
- 72 vocabulary-items
- 40 phrase-items / Actes de parole
- 30 grammar_rule-items
  - 11 rond le passé composé avec avoir
  - 19 rond l’adjectif possessif
- 1 sound_rule-item (la liaison)
- 1 dynamisch number_spec-item (0–1000)

Trajet 5 bevat **geen nieuwe permanente verb-items**: de passé-composé-oefeningen gebruiken werkwoorden die al eerder gekend zijn. Nieuwe oefenvarianten hieronder zijn geen nieuwe permanente mastery-items.

## 0.2 Oefenmodi
- **Apprendre / Leren**
  - begeleid;
  - korte regel/micro-uitleg;
  - na een fout gerichte feedback;
  - geen onafhankelijke mastery-evidence.
- **S’entraîner / Oefenen**
  - zelfstandig;
  - geen antwoord vooraf;
  - gerichte hint pas na fout;
  - onafhankelijke evidence.
- **Se tester / Test jezelf**
  - geen hints tijdens de reeks;
  - feedback op het einde;
  - onafhankelijke evidence.

## 0.3 Antwoordregels
- Accenten strikt.
- Rechte `'` en typografische `’` gelijkwaardig.
- Beginhoofdletter niet doorslaggevend.
- Eindpunt niet doorslaggevend.
- Expliciete `accepted_answers` alleen bij echte equivalenten.
- Geen brede fuzzy/AI-correctie.
- Bij bijna-correcte spelling mag een gerichte hint verschijnen.
- Open contextvragen alleen opnemen als de target voldoende eenduidig is.

## 0.4 Ambiguity rule
Voor elke vrije contextvraag:
> Als een ander actief leerwoord uit dezelfde scope logisch in hetzelfde gat past, herschrijf of schrap de vraag.

Liever géén contextoefening dan een dubbelzinnige contextoefening.

## 0.5 Mastery
- Oefenvarianten mappen naar bestaande leerdoelen.
- Geen nieuwe permanente doelen.
- Meer-gatenvragen: elk gat apart beoordelen en evidence registreren.
- Volledige vertaalzin:
  - volledig correct → positieve evidence voor gekoppelde doelen;
  - fout → integratieve vraag fout, maar niet automatisch alle onderliggende doelen negatief bestraffen.

---

# 1. Scope Trajet 5

## Wel digitaal oefenen
1. **Atelier Parole — Montrer une maison**
   - Traduire / Vertalen
   - En contexte / In een zin
   - ruimtelijke voorzetsels
   - Expressions / Actes de parole
2. **Atelier Verbes — Le passé composé avec avoir**
   - vorming met avoir
   - participe passé van regelmatige -ER / -RE / -IR-werkwoorden
   - participes passés irréguliers
   - passé composé in echte zinnen
   - contrast met présent / passé récent / futur proche
3. **Chiffres et lettres — De 0 à 1000**
   - dynamische getaltraining
4. **Atelier Grammaire — L’adjectif possessif**
   - mon / ma / mes
   - ton / ta / tes
   - son / sa / ses
   - notre / nos
   - votre / vos
   - leur / leurs
   - mon / ton / son vóór vrouwelijk enkelvoud met klinker of stomme h
5. **Révision du trajet 5**
   - integratie van huiswoordenschat, Actes, passé composé, getallen en possessieven

## Niet als aparte digitale module
- **Kiosque — La maison du futur**
- **Comment dire ? — La liaison**: geen audiomodule
- **Les verbes, le futur proche et le passé récent — Bonne mémoire ?**: bron voor integratieve herhaling, geen nieuw permanent inhoudsblok

Het bestaande liaison-item blijft in de data bestaan maar wordt niet actief aangeboden.

---

# 2. Atelier Parole — broninventaris

## 2.1 On se rappelle ?

### Substantifs
- le bureau
- la chambre
- la cuisine
- l’entrée
- l’étage
- la fois
- le garage
- le jardin
- la maison
- le parent
- la piscine
- la salle de bains
- la terrasse
- les toilettes
- le village
- la ville

### Verbes
- arriver
- commencer
- descendre
- montrer

### Adjectifs
- beau / belle
- formidable
- grand(e)
- deuxième
- petit(e)
- troisième

### Mots invariables
- encore
- en face de
- près de

### Expression
- d’accord

### Prépositions / situer dans l’espace
- à droite de
- à gauche de
- en face de
- à côté de
- devant
- derrière
- sous
- sur
- entre
- dans

## 2.2 On découvre !

### Substantifs
- l’appartement
- le balcon
- la cave
- la chambre à coucher
- la chambre d’amis
- le couloir
- le dressing
- l’escalier
- l’espace
- le grenier
- le hall
- la pièce
- la remise
- le rez-de-chaussée
- la salle à manger
- le salon
- le séjour
- le studio
- le toit
- le tour

### Verbes
- monter
- quitter

### Adjectifs
- autre
- ouvert(e)

### Mots invariables
- en bas
- en haut

### Expressions
- Bienvenue chez …
- bonne idée
- descendre l’escalier
- excellente idée
- Et nous voilà
- monter l’escalier

---

# 3. Vocabulaire — oefenarchitectuur

## 3.1 Traduire / Vertalen
Bestaande directe vertaalvorm behouden.

### Aandacht voor overlappende woorden
Geen vrije contextoefening forceren wanneer meerdere T5-woorden even logisch zijn:
- `la chambre` / `la pièce`
- `le salon` / `le séjour`
- `le bureau` kan ruimte of meubel betekenen; in deze cursus is het target de ruimte
- `en face de` staat twee keer als permanent item (mots invariables + prépositions)

De permanente IDs blijven intact. In de oefenflow vermijden we dat hetzelfde `en face de`-antwoord twee keer vlak na elkaar als “nieuw” item verschijnt.

## 3.2 En contexte / In een zin
- Franse context;
- geen Nederlandse target tussen haakjes;
- context moet één target afdwingen;
- verbogen vorm mag naar het basisitem mappen;
- bij ruimtelijke voorzetsels gebruiken we relationele context of een Nederlandse/situationele cue als de Franse zin op zichzelf meerdere antwoorden toelaat.

---

# 4. Vocabulaire — En contexte bank

## 4.1 On se rappelle ?

| ID | Prompt | Antwoord |
|---|---|---|
| T5-VOC-CTX-001 | Papa travaille sur son ordinateur dans le ___. | bureau |
| T5-VOC-CTX-002 | Je dors dans ma ___. | chambre |
| T5-VOC-CTX-003 | Maman prépare le repas dans la ___. | cuisine |
| T5-VOC-CTX-004 | On entre dans la maison par l’___. | entrée |
| T5-VOC-CTX-005 | Ma chambre est au premier ___. | étage |
| T5-VOC-CTX-006 | C’est la première ___ que je visite cette maison. | fois |
| T5-VOC-CTX-007 | La voiture est dans le ___. | garage |
| T5-VOC-CTX-008 | Il y a des fleurs et une terrasse dans le ___. | jardin |
| T5-VOC-CTX-009 | Nous habitons dans une grande ___. | maison |
| T5-VOC-CTX-010 | Ma mère est un de mes ___. | parents |
| T5-VOC-CTX-011 | En été, nous nageons dans la ___. | piscine |
| T5-VOC-CTX-012 | Je prends une douche dans la ___. | salle de bains |
| T5-VOC-CTX-013 | Quand il fait beau, nous mangeons dehors sur la ___. | terrasse |
| T5-VOC-CTX-014 | Je dois aller aux ___. | toilettes |
| T5-VOC-CTX-015 | Il y a seulement 800 habitants. C’est un petit ___. | village |
| T5-VOC-CTX-016 | Bruxelles est une grande ___. | ville |
| T5-VOC-CTX-017 | Le train ___ à la gare à neuf heures. | arrive |
| T5-VOC-CTX-018 | Le tour de la maison ___ dans le hall. | commence |
| T5-VOC-CTX-019 | Pour aller à la cave, nous devons ___. | descendre |
| T5-VOC-CTX-020 | Je vais te ___ ma nouvelle maison. | montrer |
| T5-VOC-CTX-021 | Il y a déjà une chambre, mais il y a ___ une chambre d’amis. | encore |
| T5-VOC-CTX-022 | Ma maison est tout ___ de l’école : deux minutes à pied. | près |

Geen vrije contextoefening voor `beau/belle`, `formidable`, `grand(e)`, `petit(e)`, `deuxième`, `troisième` als de zin zonder extra cue meerdere adjectieven kan toelaten. Deze worden in de Actes-/grammaticacontext gebruikt.

## 4.2 On découvre ! — la maison

| ID | Prompt | Antwoord |
|---|---|---|
| T5-VOC-CTX-023 | Nous n’habitons pas dans une maison : nous habitons dans un ___. | appartement |
| T5-VOC-CTX-024 | Je sors de ma chambre et je prends l’air sur le ___. | balcon |
| T5-VOC-CTX-025 | On garde des bouteilles et des vieux objets dans la ___. | cave |
| T5-VOC-CTX-026 | La pièce où je dors est ma ___. | chambre à coucher |
| T5-VOC-CTX-027 | Quand ma cousine vient dormir chez nous, elle dort dans la ___. | chambre d’amis |
| T5-VOC-CTX-028 | Les portes des chambres donnent sur le ___. | couloir |
| T5-VOC-CTX-029 | Je range mes vêtements dans le ___. | dressing |
| T5-VOC-CTX-030 | Pour monter au premier étage, je prends l’___. | escalier |
| T5-VOC-CTX-031 | Le grenier est grand : c’est un grand ___. | espace |
| T5-VOC-CTX-032 | Le ___ est sous le toit, tout en haut de la maison. | grenier |
| T5-VOC-CTX-033 | On commence la visite dans le ___. | hall |
| T5-VOC-CTX-034 | Une maison a plusieurs chambres et plusieurs autres ___. | pièces |
| T5-VOC-CTX-035 | Nous rangeons les vélos et des outils dans la ___. | remise |
| T5-VOC-CTX-036 | La cuisine et le salon sont au ___. | rez-de-chaussée |
| T5-VOC-CTX-037 | Nous prenons le dîner dans la ___. | salle à manger |
| T5-VOC-CTX-038 | Il y a un canapé et la télé dans le ___. | salon |
| T5-VOC-CTX-039 | Dans ce ___, il y a le salon et la cuisine ouverte. | séjour |
| T5-VOC-CTX-040 | Ma sœur habite seule dans un petit ___. | studio |
| T5-VOC-CTX-041 | La chambre du grenier est juste sous le ___. | toit |
| T5-VOC-CTX-042 | Je te montre toute la maison : on fait le ___. | tour |
| T5-VOC-CTX-043 | Pour aller au premier étage, il faut ___ l’escalier. | monter |
| T5-VOC-CTX-044 | On ___ le hall et on arrive dans le séjour. | quitte |
| T5-VOC-CTX-045 | Il y a une chambre et une ___ pièce à l’étage. | autre |
| T5-VOC-CTX-046 | Il n’y a pas de porte entre le salon et la cuisine : la cuisine est ___. | ouverte |
| T5-VOC-CTX-047 | La cave est ___. | en bas |
| T5-VOC-CTX-048 | Le grenier est ___. | en haut |

### Controle salon / séjour
- `salon` alleen gebruiken bij duidelijke clue `canapé + télé`.
- `séjour` gebruiken als bredere leefruimte uit de cursuscontext.
- Geen kale NL-cue “woonkamer” als vrije context voor beide.

---

# 5. Situeren in de ruimte

Omdat een kaal gat als `La cuisine est ___ le salon` vaak meerdere voorzetsels kan toelaten, gebruiken we **relationele paren**.

| ID | Prompt | Antwoord |
|---|---|---|
| T5-PREP-001 | Le salon est à gauche de la cuisine. La cuisine est ___ du salon. | à droite |
| T5-PREP-002 | La cuisine est à droite du salon. Le salon est ___ de la cuisine. | à gauche |
| T5-PREP-003 | La salle de bains est en face de la chambre. La chambre est ___ de la salle de bains. | en face |
| T5-PREP-004 | Le bureau est à côté de la chambre. La chambre est ___ du bureau. | à côté |
| T5-PREP-005 | Le garage est devant la remise. La remise est ___ le garage. | derrière |
| T5-PREP-006 | Le jardin est derrière la maison. La maison est ___ le jardin. | devant |
| T5-PREP-007 | Le garage est sous la chambre. La chambre est ___ le garage. | sur |
| T5-PREP-008 | La chambre est sur le garage. Le garage est ___ la chambre. | sous |
| T5-PREP-009 | La salle de bains est entre la chambre et le bureau. Elle est ___ la chambre et le bureau. | entre |
| T5-PREP-010 | Le vélo est dans le garage. Il est ___ le garage. | dans |
| T5-PREP-011 | Le salon est près de la cuisine. Il est ___ de la cuisine. | près |
| T5-PREP-012 | La cuisine est juste en face du salon. Elle est ___ du salon. | en face |

Bij `en face de` kan dezelfde correcte variant evidence geven aan de passende scope waarin de leerling oefent, maar de twee bestaande permanente IDs worden niet samengevoegd.

---

# 6. Expressions — contextbank

| ID | Prompt | Antwoord |
|---|---|---|
| T5-EXP-001 | Iemand komt voor het eerst bij jou thuis. Zeg: Welkom bij mij! | Bienvenue chez moi ! |
| T5-EXP-002 | Reageer op een goed voorstel: Goed idee. | Bonne idée. |
| T5-EXP-003 | Zeg: We gaan de trap af. | On descend l’escalier. |
| T5-EXP-004 | Reageer enthousiast: Uitstekend idee! | Excellente idée ! |
| T5-EXP-005 | Je komt op de volgende verdieping aan. Zeg: En hier zijn we dan. | Et nous voilà. |
| T5-EXP-006 | Zeg: We gaan de trap op. | On monte l’escalier. |
| T5-EXP-007 | Reageer: Akkoord / afgesproken. | D’accord. |

Bij vrije communicatieve situaties kunnen `Bonne idée !`, `Excellente idée !`, `Chouette !`, `Génial !` soms allemaal passend zijn. Bij directe vertaling blijft het target specifiek.

---

# 7. Actes de parole — Montrer une maison

De 40 bestaande phrase-items blijven de permanente targets.
Onderstaande varianten zijn situationele oefenvormen.

| ID | Situatie | Verwacht antwoord |
|---|---|---|
| T5-ACT-001 | Zeg welk type woning je hebt: We wonen in een rijhuis. | On habite dans une maison en rangée. |
| T5-ACT-002 | Bied aan het huis te tonen. | Je te montre la maison ? |
| T5-ACT-003 | Start de rondleiding: Hier is de hal. | Voici le hall. |
| T5-ACT-004 | Zeg: We beginnen de rondleiding in de hal. | On commence le tour de la maison dans le hall. |
| T5-ACT-005 | Zeg: Nu verlaten we de hal en komen we in de woonkamer. | Maintenant, on quitte le hall et on arrive dans le séjour. |
| T5-ACT-006 | Zeg: Voor ons is het salon. | Devant nous, c’est le salon. |
| T5-ACT-007 | Zeg: Naast het salon is er de eetkamer. | À côté, il y a la salle à manger. |
| T5-ACT-008 | Zeg: Rechts van de eetkamer is er de keuken. | À droite de la salle à manger, il y a la cuisine. |
| T5-ACT-009 | Vraag: Hebben jullie een kelder? | Vous avez une cave ? |
| T5-ACT-010 | Zeg: Beneden is er een grote kelder. | En bas, il y a une grande cave. |
| T5-ACT-011 | Zeg hoe je in de kelder komt: via de trap in de garage. | On arrive à la cave par l’escalier dans le garage. |
| T5-ACT-012 | Zeg: Ja, met een terras en een zwembad. | Oui, avec une terrasse et une piscine. |
| T5-ACT-013 | Stel voor om naar boven te gaan. | On monte l’escalier ? |
| T5-ACT-014 | Zeg wat er op de eerste verdieping is. | Au premier étage, on a deux chambres à coucher, une salle de bains et un bureau. |
| T5-ACT-015 | Zeg: Rechts van de gang. | À droite du couloir. |
| T5-ACT-016 | Zeg: Het is de tweede deur. | C’est la deuxième porte. |
| T5-ACT-017 | Zeg: Naast mijn kamer is de slaapkamer van mijn ouders. | À côté de ma chambre, il y a la chambre à coucher de mes parents. |
| T5-ACT-018 | Zeg: De toiletten zijn tegenover mijn kamer. | Les toilettes sont en face de ma chambre. |
| T5-ACT-019 | Zeg: Ik wacht op je in de gang. | Je t’attends dans le couloir. |
| T5-ACT-020 | Zeg: Boven is er nog de zolder. Het is een grote ruimte. | En haut, il y a encore le grenier. C’est un grand espace. |
| T5-ACT-021 | Zeg: Op de tweede verdieping is er een bureau. | Au deuxième étage, il y a un bureau. |
| T5-ACT-022 | Stel voor iets te drinken. | On va boire un verre ? |
| T5-ACT-023 | Reageer: Goed idee. | Bonne idée. |
| T5-ACT-024 | Reageer op de hal: Wat een mooie ingang! | Quelle belle entrée ! |
| T5-ACT-025 | Reageer op het salon: Wat een mooi salon! | Quel beau salon ! |
| T5-ACT-026 | Reageer: O, een open keuken! Ik hou ervan! | Oh, une cuisine ouverte ! J’adore ! |
| T5-ACT-027 | Vraag: Zijn er nog andere kamers op het gelijkvloers? | Il y a encore d’autres pièces au rez-de-chaussée ? |
| T5-ACT-028 | Vraag: Is er ook een tuin? | Il y a aussi un jardin ? |
| T5-ACT-029 | Reageer op de tuin: Wat een grote tuin! | Quel grand jardin ! |
| T5-ACT-030 | Vraag: Waar is je kamer? | Et où est ta chambre ? |
| T5-ACT-031 | Reageer: Oké, ik zie het. | O.K., je vois. |
| T5-ACT-032 | Vraag: Zijn er toiletten op de verdieping? | Il y a des toilettes à l’étage ? |
| T5-ACT-033 | Vraag of er boven nog andere kamers zijn. | Il y a encore d’autres pièces en haut ? |
| T5-ACT-034 | Reageer enthousiast: Uitstekend idee! | Excellente idée ! |
| T5-ACT-035 | Geef een algemeen compliment: Het is een heel mooi huis. | C’est une très belle maison. |
| T5-ACT-036 | Bedank: Heel erg bedankt. | Merci beaucoup. |

### Accepted-answerbeleid
Als een bronphrase meerdere varianten met `/` bevat, worden alleen varianten die dezelfde situationele betekenis hebben geaccepteerd.
Geen brede automatische paraphrasematching.

---

# 8. Atelier Verbes — Le passé composé avec avoir

## 8.1 Permanente grammar targets

### Vorm en gebruik
1. passé composé avec avoir = avoir in indicatif présent + participe passé
2. regelmatig -ER → stam + `é`
3. regelmatig -RE → stam + `u`
4. regelmatig -IR → stam + `i`
5. gebruik: zeggen wat in het verleden gedaan is

### Participes passés irréguliers
6. avoir → eu
7. être → été
8. faire → fait
9. mettre → mis
10. prendre → pris
11. (re)tenir → (re)tenu

Geen nieuwe permanente verb-items aanmaken.

---

# 9. Participe passé — vormbank

## 9.1 Regelmatig -ER

| ID | Vraag | Antwoord |
|---|---|---|
| T5-PP-ER-001 | regarder → participe passé | regardé |
| T5-PP-ER-002 | jouer → participe passé | joué |
| T5-PP-ER-003 | aider → participe passé | aidé |
| T5-PP-ER-004 | habiter → participe passé | habité |
| T5-PP-ER-005 | travailler → participe passé | travaillé |
| T5-PP-ER-006 | écouter → participe passé | écouté |
| T5-PP-ER-007 | dessiner → participe passé | dessiné |
| T5-PP-ER-008 | ranger → participe passé | rangé |
| T5-PP-ER-009 | commencer → participe passé | commencé |
| T5-PP-ER-010 | préparer → participe passé | préparé |

## 9.2 Regelmatig -RE

| ID | Vraag | Antwoord |
|---|---|---|
| T5-PP-RE-001 | rendre → participe passé | rendu |
| T5-PP-RE-002 | attendre → participe passé | attendu |
| T5-PP-RE-003 | perdre → participe passé | perdu |
| T5-PP-RE-004 | vendre → participe passé | vendu |
| T5-PP-RE-005 | répondre → participe passé | répondu |

## 9.3 Regelmatig -IR

| ID | Vraag | Antwoord |
|---|---|---|
| T5-PP-IR-001 | finir → participe passé | fini |
| T5-PP-IR-002 | choisir → participe passé | choisi |
| T5-PP-IR-003 | remplir → participe passé | rempli |
| T5-PP-IR-004 | dormir → participe passé | dormi |
| T5-PP-IR-005 | servir → participe passé | servi |

### Didactische nuance
De cursus groepeert de vormen in deze leerfase als:
- ER → é
- RE → u
- IR → i

Gebruik alleen werkwoorden die in de cursus/oefeningen binnen dit patroon worden aangeboden. Codex mag niet op basis van enkel de infinitiefuitgang zelf nieuwe Franse participes gaan verzinnen.

---

# 10. Participes passés irréguliers

| ID | Vraag | Antwoord |
|---|---|---|
| T5-PP-IRR-001 | avoir → participe passé | eu |
| T5-PP-IRR-002 | être → participe passé | été |
| T5-PP-IRR-003 | faire → participe passé | fait |
| T5-PP-IRR-004 | mettre → participe passé | mis |
| T5-PP-IRR-005 | prendre → participe passé | pris |
| T5-PP-IRR-006 | tenir → participe passé | tenu |
| T5-PP-IRR-007 | retenir → participe passé | retenu |

Microfeedback in Apprendre:
- toon het infinitief + correcte participe passé;
- laat de leerling na een fout de juiste vorm opnieuw typen.

---

# 11. Passé composé — basiszinnen

Infinitief blijft zichtbaar tussen haakjes wanneer het doel de tijdsvorm is.

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T5-PC-CTX-001 | 1 | Hier, j’___ la télé. (regarder) | ai regardé |
| T5-PC-CTX-002 | 1 | Tu ___ tes parents. (aider) | as aidé |
| T5-PC-CTX-003 | 1 | Il ___ sur Internet. (surfer) | a surfé |
| T5-PC-CTX-004 | 1 | Elle ___ un dessin. (dessiner) | a dessiné |
| T5-PC-CTX-005 | 1 | Nous ___ de la musique. (écouter) | avons écouté |
| T5-PC-CTX-006 | 1 | Vous ___ dans le jardin. (travailler) | avez travaillé |
| T5-PC-CTX-007 | 1 | Ils ___ au padel. (jouer) | ont joué |
| T5-PC-CTX-008 | 1 | Elles ___ la chambre. (ranger) | ont rangé |
| T5-PC-CTX-009 | 2 | Papa ___ des crêpes. (préparer) | a préparé |
| T5-PC-CTX-010 | 2 | Emma ___ à Bruxelles. (habiter) | a habité |
| T5-PC-CTX-011 | 2 | Mes cousins ___ un film. (regarder) | ont regardé |
| T5-PC-CTX-012 | 3 | Mon frère et moi ___ la maison. (visiter) | avons visité |

## 11.1 -RE / -IR in context

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T5-PC-CTX-013 | 1 | J’___ le livre. (rendre) | ai rendu |
| T5-PC-CTX-014 | 1 | Tu ___ le bus longtemps. (attendre) | as attendu |
| T5-PC-CTX-015 | 2 | Lucas ___ son téléphone. (perdre) | a perdu |
| T5-PC-CTX-016 | 3 | Mes parents ___ leur voiture. (vendre) | ont vendu |
| T5-PC-CTX-017 | 1 | Nous ___ à la question. (répondre) | avons répondu |
| T5-PC-CTX-018 | 1 | J’___ mon devoir. (finir) | ai fini |
| T5-PC-CTX-019 | 2 | Emma ___ une glace. (choisir) | a choisi |
| T5-PC-CTX-020 | 3 | Les élèves ___ le formulaire. (remplir) | ont rempli |
| T5-PC-CTX-021 | 2 | Mon frère ___ longtemps. (dormir) | a dormi |
| T5-PC-CTX-022 | 3 | Lucas et Emma ___ le dessert. (servir) | ont servi |

## 11.2 Irregular in context

| ID | Niveau | Vraag | Antwoord |
|---|---:|---|---|
| T5-PC-CTX-023 | 1 | J’___ un accident. (avoir) | ai eu |
| T5-PC-CTX-024 | 2 | Nous ___ à Liège samedi. (être) | avons été |
| T5-PC-CTX-025 | 1 | Tu ___ du vélo. (faire) | as fait |
| T5-PC-CTX-026 | 2 | Emma ___ sa veste. (mettre) | a mis |
| T5-PC-CTX-027 | 1 | Vous ___ le train. (prendre) | avez pris |
| T5-PC-CTX-028 | 2 | Lucas ___ le ballon. (tenir) | a tenu |
| T5-PC-CTX-029 | 3 | Les élèves ___ les nouveaux mots. (retenir) | ont retenu |

### Belangrijke regel
Deze module is **passé composé avec avoir**.
Geen passé-composévragen toevoegen met werkwoorden die in de bedoelde betekenis `être` als hulpwerkwoord vereisen.

---

# 12. Passé composé — tijdscontext herkennen

Hier kiest de leerling tussen présent, passé récent, futur proche en passé composé.
Alleen gebruiken wanneer de tijdscontext het antwoord duidelijk maakt.

| ID | Vraag | Antwoord |
|---|---|---|
| T5-TENSE-MIX-001 | Chaque lundi, je ___ au padel. (jouer) | joue |
| T5-TENSE-MIX-002 | Je sors du terrain : je ___ au padel. (jouer) | viens de jouer |
| T5-TENSE-MIX-003 | Ce soir, je ___ au padel. (jouer) | vais jouer |
| T5-TENSE-MIX-004 | Lundi dernier, j’___ au padel. (jouer) | ai joué |
| T5-TENSE-MIX-005 | Normalement, Emma ___ la télé. (regarder) | regarde |
| T5-TENSE-MIX-006 | Elle vient d’éteindre la télé : elle ___ la télé. (regarder) | vient de regarder |
| T5-TENSE-MIX-007 | Dans une heure, elle ___ la télé. (regarder) | va regarder |
| T5-TENSE-MIX-008 | Hier soir, elle ___ la télé. (regarder) | a regardé |
| T5-TENSE-MIX-009 | Chaque dimanche, nous ___ des crêpes. (préparer) | préparons |
| T5-TENSE-MIX-010 | Les crêpes sont prêtes : nous ___ des crêpes. (préparer) | venons de préparer |
| T5-TENSE-MIX-011 | Demain, nous ___ des crêpes. (préparer) | allons préparer |
| T5-TENSE-MIX-012 | Dimanche dernier, nous ___ des crêpes. (préparer) | avons préparé |

In `Se tester` kan het tijdslabel wegvallen; de contextwoorden moeten dan zichtbaar blijven.

---

# 13. Chiffres et lettres — De 0 à 1000

## 13.1 Permanente mastery
Er is **één bestaand number_spec-item** voor 0–1000.
Maak geen 1001 permanente number-items.

## 13.2 Didactisch doel uit de cursus
Leerlingen moeten de getallen vooral:
- vlot begrijpen;
- vlot gebruiken;
- hardop kunnen lezen.

Perfecte spelling van elk getal is niet het hoofddoel.

## 13.3 Oefenvormen

### Lettres → chiffres — primair
`sept-cent-quarante-deux → 742`

### Chiffres → lettres — secundair
`574 → cinq-cent-septante-quatre`

Bij schrijfvragen:
- accenten/spelling blijven normaal gecontroleerd;
- maar mastery van de number_spec mag niet disproportioneel zakken door één kleine koppeltekenfout als de getalswaarde ondubbelzinnig correct is.
- onderscheid `waarde correct` en `spelling volledig correct`.

### Context
- huisnummers
- prijzen
- telefoonnummers in groepen
- afstanden/hoogtes
- aantallen

## 13.4 Belgische hoofdvormen
Primair:
- 70 `septante`
- 90 `nonante`

Franse regionale alternatieven:
- `soixante-dix...`
- `quatre-vingt-dix...`
worden als correct alternatief geaccepteerd.

## 13.5 Honderdtallen
- 100 `cent`
- 101 `cent-un`
- 200 `deux-cents`
- 201 `deux-cent-un`
- 300 `trois-cents`
- ...
- 1000 `mille`

Regel:
`cent` krijgt alleen `s` wanneer het vermenigvuldigd wordt en er niets meer achter volgt.

## 13.6 Sampling
Balanceer langere reeksen over:
- 0–99
- 100–199
- 200–499
- 500–799
- 800–1000

---

# 14. Atelier Grammaire — L’adjectif possessif

## 14.1 Conceptuele kern
Het bezittelijk adjectief wordt gekozen op basis van:
1. **wie bezit?** → mijn / jouw / zijn-haar / ons / jullie-uw / hun
2. **het Franse woord dat erna komt** → mannelijk, vrouwelijk of meervoud

Cruciaal:
`son / sa / ses` betekent zowel **zijn** als **haar**.
De vorm hangt niet af van het geslacht van de bezitter, maar van het zelfstandig naamwoord.

Voorbeeld:
- Julie cherche **son** vélo.
- Julie cherche **sa** veste.
- Marc cherche **son** vélo.
- Marc cherche **sa** veste.

## 14.2 Speciale regel
Voor een vrouwelijk enkelvoudig woord dat met klinker of stomme h begint:
- `mon`
- `ton`
- `son`

Voorbeeld:
- mon école
- ton adresse
- son horloge

---

# 15. Possessifs — mon / ma / mes

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-MON-001 | C’est ___ vélo. (mijn) | mon |
| T5-POSS-MON-002 | C’est ___ chambre. (mijn) | ma |
| T5-POSS-MON-003 | Ce sont ___ parents. (mijn) | mes |
| T5-POSS-MON-004 | Je cherche ___ sac à dos. (mijn) | mon |
| T5-POSS-MON-005 | Je montre ___ maison. (mijn) | ma |
| T5-POSS-MON-006 | Je range ___ chaussures. (mijn) | mes |
| T5-POSS-MON-007 | ___ frère habite à Bruxelles. (mijn) | Mon |
| T5-POSS-MON-008 | ___ sœur est sportive. (mijn) | Ma |
| T5-POSS-MON-009 | ___ cousins arrivent demain. (mijn) | Mes |

---

# 16. Possessifs — ton / ta / tes

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-TON-001 | Où est ___ vélo ? (jouw) | ton |
| T5-POSS-TON-002 | J’aime ___ chambre. (jouw) | ta |
| T5-POSS-TON-003 | Où sont ___ baskets ? (jouw) | tes |
| T5-POSS-TON-004 | Tu ranges ___ sac. (jouw) | ton |
| T5-POSS-TON-005 | Tu montres ___ maison. (jouw) | ta |
| T5-POSS-TON-006 | Tu cherches ___ clés. (jouw) | tes |
| T5-POSS-TON-007 | ___ frère est à la maison. (jouw) | Ton |
| T5-POSS-TON-008 | ___ sœur est au jardin. (jouw) | Ta |
| T5-POSS-TON-009 | ___ parents travaillent. (jouw) | Tes |

---

# 17. Possessifs — son / sa / ses

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-SON-001 | Julie cherche ___ vélo. | son |
| T5-POSS-SON-002 | Julie cherche ___ veste. | sa |
| T5-POSS-SON-003 | Julie cherche ___ chaussures. | ses |
| T5-POSS-SON-004 | Marc range ___ sac. | son |
| T5-POSS-SON-005 | Marc montre ___ chambre. | sa |
| T5-POSS-SON-006 | Marc appelle ___ parents. | ses |
| T5-POSS-SON-007 | Emma aime ___ jardin. | son |
| T5-POSS-SON-008 | Emma visite ___ tante. | sa |
| T5-POSS-SON-009 | Emma voit ___ cousins. | ses |
| T5-POSS-SON-010 | Lucas prend ___ vélo. | son |
| T5-POSS-SON-011 | Lucas prépare ___ valise. | sa |
| T5-POSS-SON-012 | Lucas cherche ___ affaires. | ses |

Microfeedback bij fout:
> Kijk naar het woord **na** het bezittelijk adjectief, niet naar de persoon die bezit.

---

# 18. Possessifs — notre / nos

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-NOTRE-001 | C’est ___ maison. (onze) | notre |
| T5-POSS-NOTRE-002 | C’est ___ bureau. (ons) | notre |
| T5-POSS-NOTRE-003 | Ce sont ___ chambres. (onze) | nos |
| T5-POSS-NOTRE-004 | Nous aimons ___ jardin. | notre |
| T5-POSS-NOTRE-005 | Nous visitons ___ grands-parents. | nos |
| T5-POSS-NOTRE-006 | Voilà ___ nouvelle cuisine. | notre |

---

# 19. Possessifs — votre / vos

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-VOTRE-001 | C’est ___ maison. (jullie/uw) | votre |
| T5-POSS-VOTRE-002 | C’est ___ garage. (jullie/uw) | votre |
| T5-POSS-VOTRE-003 | Ce sont ___ chambres. (jullie/uw) | vos |
| T5-POSS-VOTRE-004 | Où est ___ chambre ? | votre |
| T5-POSS-VOTRE-005 | J’aime beaucoup ___ jardin. | votre |
| T5-POSS-VOTRE-006 | Où sont ___ chaussures ? | vos |

---

# 20. Possessifs — leur / leurs

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-LEUR-001 | Les parents cherchent ___ enfant. | leur |
| T5-POSS-LEUR-002 | Les parents cherchent ___ fille. | leur |
| T5-POSS-LEUR-003 | Les parents cherchent ___ enfants. | leurs |
| T5-POSS-LEUR-004 | Lucas et Emma montrent ___ maison. | leur |
| T5-POSS-LEUR-005 | Lucas et Emma rangent ___ chambres. | leurs |
| T5-POSS-LEUR-006 | Mes grands-parents aiment ___ jardin. | leur |
| T5-POSS-LEUR-007 | Les élèves prennent ___ sacs. | leurs |
| T5-POSS-LEUR-008 | Mes cousins visitent ___ grand-mère. | leur |

Microfeedback:
- meerdere bezitters + één bezit → `leur`
- meerdere bezitters + meerdere bezittingen → `leurs`

---

# 21. Mon / ton / son vóór klinker of stomme h

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-VOW-001 | C’est ___ école. (mijn) | mon |
| T5-POSS-VOW-002 | Quelle est ___ adresse ? (jouw) | ton |
| T5-POSS-VOW-003 | Julie regarde ___ horloge. | son |
| T5-POSS-VOW-004 | Je montre ___ entrée. | mon |
| T5-POSS-VOW-005 | Tu cherches ___ amie. | ton |
| T5-POSS-VOW-006 | Emma parle à ___ amie. | son |

Microfeedback:
> Het woord is vrouwelijk, maar begint met een klinker/stomme h: gebruik **mon / ton / son**.

---

# 22. Possessifs — gemengde bank

| ID | Vraag | Antwoord |
|---|---|---|
| T5-POSS-MIX-001 | Je ne joue plus souvent dans ___ chambre. (mijn) | ma |
| T5-POSS-MIX-002 | La salle à manger et la cuisine sont ___ pièces préférées. (mijn) | mes |
| T5-POSS-MIX-003 | Tu invites toute la famille pour ___ anniversaire. (jouw) | ton |
| T5-POSS-MIX-004 | Tes parents travaillent trop. | Tes |
| T5-POSS-MIX-005 | Voilà mon lapin. ___ oreilles sont très longues. | Ses |
| T5-POSS-MIX-006 | Marc montre ___ nouvelle voiture. | sa |
| T5-POSS-MIX-007 | Nous aimons beaucoup ___ grands-parents. | nos |
| T5-POSS-MIX-008 | Vous voyez ___ nouveau toit ? | votre |
| T5-POSS-MIX-009 | Les cousins viennent avec ___ parents. | leurs |
| T5-POSS-MIX-010 | Julie et Lucille vont chez ___ grands-parents. | leurs |
| T5-POSS-MIX-011 | C’est ___ premier voyage en France ? (hun) | leur |
| T5-POSS-MIX-012 | Où est ___ nouvelle maison ? (jullie) | votre |
| T5-POSS-MIX-013 | Ma sœur cherche ___ GSM. | son |
| T5-POSS-MIX-014 | Mon frère cherche ___ chambre. | sa |
| T5-POSS-MIX-015 | Mes parents rangent ___ affaires. | leurs |
| T5-POSS-MIX-016 | Nous montrons ___ appartement à nos amis. | notre |
| T5-POSS-MIX-017 | Je retrouve ___ amis dans le hall. | mes |
| T5-POSS-MIX-018 | Tu retrouves ___ amie devant l’école. | ton |
| T5-POSS-MIX-019 | Sarah retrouve ___ amie à la piscine. | son |
| T5-POSS-MIX-020 | Vous rangez ___ chaussures dans le couloir. | vos |

### Correctie T5-POSS-MIX-004
Dit item bevat geen gat en is dus geen oefenvariant.
Niet opnemen in de definitieve data.
Vervang door:
`___ parents travaillent trop. (jouw) → Tes`

Definitieve T5-POSS-MIX-004:
`___ parents travaillent trop. (jouw) → Tes`

---

# 23. Révision du trajet 5

Aparte tegel:
**Révision du trajet**
*Alles door elkaar*

Combineert:
- kamers/ruimte/voorzetsels;
- een huis tonen;
- passé composé avec avoir;
- participes passés;
- getallen 0–1000;
- adjectifs possessifs;
- eerder gekende présent / futur proche / passé récent waar de cursus ze opnieuw contrasteert.

---

# 24. Révision — volledige zinnen NL → FR

| ID | Nederlands | Correct Frans |
|---|---|---|
| T5-REV-001 | Welkom bij mij! Ik zal je het huis tonen. | Bienvenue chez moi ! Je vais te montrer la maison. |
| T5-REV-002 | De keuken is rechts van de eetkamer. | La cuisine est à droite de la salle à manger. |
| T5-REV-003 | Mijn kamer is op de eerste verdieping. | Ma chambre est au premier étage. |
| T5-REV-004 | De toiletten zijn tegenover mijn kamer. | Les toilettes sont en face de ma chambre. |
| T5-REV-005 | Boven is er nog een grote zolder. | En haut, il y a encore un grand grenier. |
| T5-REV-006 | Gisteren heb ik de televisie gekeken. | Hier, j’ai regardé la télé. |
| T5-REV-007 | Wij hebben de vraag beantwoord. | Nous avons répondu à la question. |
| T5-REV-008 | Emma heeft haar jas aangetrokken. | Emma a mis sa veste. |
| T5-REV-009 | Mijn ouders hebben de trein genomen. | Mes parents ont pris le train. |
| T5-REV-010 | De leerlingen hebben de nieuwe woorden onthouden. | Les élèves ont retenu les nouveaux mots. |
| T5-REV-011 | Julie zoekt haar fiets. | Julie cherche son vélo. |
| T5-REV-012 | Julie zoekt haar jas. | Julie cherche sa veste. |
| T5-REV-013 | Wij tonen ons huis aan onze vrienden. | Nous montrons notre maison à nos amis. |
| T5-REV-014 | Mijn ouders zoeken hun sleutels. | Mes parents cherchent leurs clés. |
| T5-REV-015 | Dat is mijn school. | C’est mon école. |

---

# 25. Révision — gemengde invulzinnen

| ID | Vraag | Antwoord(en) |
|---|---|---|
| T5-REV-016 | Papa travaille dans le ___. | bureau |
| T5-REV-017 | Le grenier est sous le ___. | toit |
| T5-REV-018 | Le salon est à gauche de la cuisine. La cuisine est ___ du salon. | à droite |
| T5-REV-019 | Hier, nous ___ la maison. (visiter) | avons visité |
| T5-REV-020 | Emma ___ sa veste. (mettre, passé composé) | a mis |
| T5-REV-021 | Les enfants ___ leur devoir. (finir, passé composé) | ont fini |
| T5-REV-022 | Julie cherche ___ vélo. | son |
| T5-REV-023 | Julie cherche ___ veste. | sa |
| T5-REV-024 | Mes parents montrent ___ maison. | leur |
| T5-REV-025 | Mes parents rangent ___ affaires. | leurs |

---

# 26. Révision — nombres

| ID | Vraag | Antwoord |
|---|---|---|
| T5-REV-026 | Écris `sept-cent-quarante-deux` en chiffres. | 742 |
| T5-REV-027 | Écris 955 en lettres. | neuf-cent-cinquante-cinq |
| T5-REV-028 | Écris 200 en lettres. | deux-cents |
| T5-REV-029 | Écris 201 en lettres. | deux-cent-un |
| T5-REV-030 | Écris 1000 en lettres. | mille |

Regionale alternatieven voor 70/90-reeksen volgens §13 accepteren.

---

# 27. Révision — mini-dialogen / teksten

### T5-REV-031 — Rondleiding
— Bienvenue chez moi !  
— Merci ! Tu me montres la maison ?  
— Oui. On commence dans le ___. À droite, il y a le salon. À côté du salon, il y a la ___.  
— Et ta chambre ?  
— Elle est au premier ___.

Antwoorden:
`hall` · `salle à manger` · `étage`

### T5-REV-032 — Ruimte
Le bureau est à gauche de la chambre.  
La chambre est donc ___ du bureau.  
Le garage est sous la chambre.  
La chambre est ___ le garage.

Antwoorden:
`à droite` · `sur`

### T5-REV-033 — Weekend
Samedi, j’___ un film. (regarder)  
J’___ des frites. (manger)  
Et j’___ du vélo avec mon frère. (faire)

Antwoorden:
`ai regardé` · `ai mangé` · `ai fait`

### T5-REV-034 — Tijden
Chaque semaine, Emma range sa chambre.  
Elle vient de terminer : elle ___ sa chambre. (passé récent)  
Hier, elle ___ sa chambre. (passé composé)  
Demain, elle ___ sa chambre. (futur proche)

Antwoorden:
`vient de ranger` · `a rangé` · `va ranger`

### T5-REV-035 — Possessifs
Julie et Lucas habitent dans une maison.  
___ maison est grande.  
Ils montrent ___ jardin et ___ chambres à leurs amis.

Antwoorden:
`Leur` · `leur` · `leurs`

### T5-REV-036 — Alles samen
— Tu me montres ___ chambre ? (jouw)  
— Oui. Elle est au premier étage. Hier, j’___ la chambre. (ranger)  
— Et cette guitare ?  
— C’est ___ guitare. (mijn)

Antwoorden:
`ta` · `ai rangé` · `ma`

---

# 28. UI-regels Trajet 5

## Vocabulaire
Twee hoofdvormen:
- Traduire / Vertalen
- En contexte / In een zin

Ruimtelijke voorzetsels zitten in dezelfde contentmodule met een klein label `Position / Plaats`.

## Actes de parole
Eén duidelijke module:
**Montrer une maison / Een huis tonen**

Geen 40 aparte tegels.

## Verbes
Hoofdvormen:
- **Participe passé**
- **Dans une phrase / Passé composé**

Kleine filter/chips:
- ER
- RE
- IR
- Irrégulier
- Mélange

Het contrast met présent / passé récent / futur proche verschijnt pas in de gemengde moeilijkere laag.

## Nombres
Aparte tegel:
**De 0 à 1000**

## Grammaire
Hoofdkeuzes:
- **mon / ma / mes**
- **ton / ta / tes**
- **son / sa / ses**
- **notre / votre / leur**
- **Mélange**

De klinkerregel (`mon école`, `ton adresse`, `son horloge`) is een moeilijkheidslaag, geen aparte grote tegel.

---

# 29. Mapping- en implementatieregels voor Codex

1. Gebruik bestaande permanente item-ID’s uit `course.json`.
2. Verander de 144 bestaande T5-items niet qua ID.
3. Nieuwe variant-ID’s zijn oefenvarianten, geen course-items.
4. Kiosque, liaison en Bonne mémoire niet als aparte actieve oefenmodule tonen.
5. Behoud het liaison sound_rule-item in data.
6. Vocab-contextvarianten mappen naar bestaande vocabulary-items.
7. Phrase-/Actes-varianten mappen naar bestaande phrase-items.
8. `en face de` komt twee keer als permanent item voor:
   - IDs niet samenvoegen;
   - in UI geen onnodige dubbele vraag vlak na elkaar.
9. Passé composé:
   - evidence voor vorm/gebruik/participe naar de 11 bestaande T5 grammar_rule-items;
   - alleen waar technisch passend daarnaast bewijs naar reeds bestaande lexicale/conjugatiedoelen uit eerdere Trajets.
10. Geen nieuwe T5 verb-items genereren.
11. Geen passé-composévragen met `être` als hulpwerkwoord toevoegen aan deze module.
12. Number range 0–1000:
   - één bestaand number_spec-item;
   - geen 1001 permanente number-items.
13. Belgische `septante/nonante` primair; regionale Franse vormen accepted.
14. Possessive variants mappen op de 19 bestaande grammar_rule-items.
15. `son/sa/ses` nooit op basis van het geslacht van de bezitter laten bepalen.
16. `mon/ton/son` vóór vrouwelijk enkelvoud met klinker/stomme h expliciet ondersteunen.
17. Multi-gap: elk gat apart beoordelen.
18. Volledige vertaalzinnen: geen blanket negative mastery bij één fout.
19. Randomisatie kiest alleen uit goedgekeurde statische banken plus gecontroleerde number-generator.
20. Geen automatische AI-zingeneratie.
21. Respecteer bestaande rounds/task/mastery-architectuur.

---

# 30. Kwaliteitscontrole — ronde 1: brongetrouwheid

Gecontroleerd:
- 144 permanente T5-items exact uit het bestaande bronpakket;
- Atelier Parole volgt `Montrer une maison`;
- ruimtewoorden, voorzetsels en Actes sluiten aan bij À retenir en de oefeningen;
- passé composé beperkt tot `avec avoir`;
- regelmatige participes volgens de drie cursuspatronen;
- onregelmatige participes exact uit de cursus;
- numbers dynamisch 0–1000;
- possessifs exact volgens de 19 bestaande regels;
- liaison uitgesloten conform projectkeuze.

---

# 31. Kwaliteitscontrole — ronde 2: ambiguïteit/didactiek

Gecontroleerd en aangepast:
- `chambre/pièce` niet als vrije synoniemen door elkaar;
- `salon/séjour` alleen met duidelijke context;
- ruimtelijke voorzetsels krijgen relationele context;
- passé-composézinnen gebruiken tijdscontext waar tijdskeuze relevant is;
- geen werkwoorden toegevoegd waarvoor passé composé met `être` nodig is;
- `son/sa/ses` contextualiseert duidelijk het bezeten zelfstandig naamwoord;
- `leur/leurs` oefent expliciet één versus meerdere bezittingen;
- klinkerregel krijgt aparte gerichte voorbeelden.

---

# 32. Kwaliteitscontrole — ronde 3: technische consistentie

Gecontroleerd:
- number_spec blijft één permanent item;
- sound_rule blijft bestaan maar verborgen;
- geen nieuwe verb-items in T5;
- variant-ID’s uniek;
- multi-gap scoring per gat;
- integratieve vertaling geeft geen blanket negatieve mastery;
- numbervarianten vergroten mastery denominator niet;
- communicatieve accepted answers worden contextafhankelijk gebruikt.

---

# 33. Gevonden data-aandachtspunten

## 33.1 `en face de` dubbel aanwezig
In het bronpakket komt `en face de` tweemaal voor:
- als `mots invariables`
- als `prépositions`

De permanente IDs blijven behouden.
Mon parcours moet voorkomen dat de leerling daardoor twee vrijwel identieke vragen vlak na elkaar krijgt.

## 33.2 Phrase-accepted answers versus directe vertaling
Bij Actes de parole zijn sommige reacties bewust uitwisselbaar.
Voor directe phrase-training mogen die niet automatisch allemaal synoniemen worden.

Voorbeeld:
- `Bonne idée.` is het directe target “Goed idee.”
- `Oh, oui.` kan in een dialoog communicatief passen, maar is niet dezelfde letterlijke vertaling.

Gebruik dus:
- **Traduire** → target-specifiek
- **situationele Actes** → communicatief ruimer

---

# 34. Status Trajet 5

Inhoudelijk uitgewerkt:
- Vocabulaire huis/woning
- Situeren in de ruimte
- Montrer une maison
- Passé composé avec avoir
- Participe passé ER / RE / IR
- Participes passés irréguliers
- Nombres 0–1000
- Adjectifs possessifs
- Révision intégrative

Bewust niet als aparte digitale oefenbank:
- La maison du futur / Kiosque
- La liaison
- Bonne mémoire 7

Trajet 5 is klaar om als contentbron voor Codex gebruikt te worden.


---

# SOURCE CONTENT — TRAJET 6

# Mon parcours — Trajet 6 Content Spec
Version: v1 — zelfstandig uitgewerkt en meermaals gecontroleerd
Bron: Univers français 1 — Trajet 6 + bestaand UF1 Trajet 4–5–6-bronpakket
Doel: inhoudelijke bron voor Codex. Codex mag de didactische inhoud niet zelf uitbreiden of herschrijven zonder expliciete instructie.

---

# 0. Algemene afspraken uit Trajet 1–5 blijven gelden

## 0.1 Permanente leeritems
De bestaande permanente course-items en item-ID’s blijven onaangeroerd.

Trajet 6 bevat in het huidige bronpakket exact **157 permanente items**:
- **76 vocabulary-items**
  - 65 binnen Atelier Parole
  - 11 leesteken-items binnen Atelier Grammaire
- **42 phrase-items / Actes de parole**
- **32 grammar_rule-items**
  - 18 rond le passé composé avec être
  - 14 rond la question
- **6 bestaande `sound_rule`-items** voor `a/à`, `ou/où`, `la/là`
- **1 dynamisch number_spec-item** voor 0–100 000

Belangrijk: de 6 items `a/à`, `ou/où`, `la/là` zijn inhoudelijk **spelling/homofonen**, geen audio-oefeningen. Ze mogen dus wél actief geoefend worden in Mon parcours, ondanks hun huidige technische itemtype `sound_rule`.

Nieuwe oefenvarianten hieronder zijn **geen nieuwe permanente mastery-items**.

## 0.2 Oefenmodi
- **Apprendre / Leren**
  - begeleid;
  - korte regel/micro-uitleg;
  - na een fout gerichte feedback;
  - geen onafhankelijke mastery-evidence.
- **S’entraîner / Oefenen**
  - zelfstandig;
  - geen antwoord vooraf;
  - gerichte hint pas na fout;
  - onafhankelijke evidence.
- **Se tester / Test jezelf**
  - geen hints tijdens de reeks;
  - feedback op het einde;
  - onafhankelijke evidence.

## 0.3 Antwoordregels
- Accenten strikt.
- Rechte `'` en typografische `’` gelijkwaardig.
- Beginhoofdletter niet doorslaggevend.
- Eindpunt niet doorslaggevend.
- Expliciete `accepted_answers` alleen bij echte equivalenten.
- Geen brede fuzzy/AI-correctie.
- Bij bijna-correcte spelling mag een gerichte hint verschijnen.
- Open contextvragen alleen opnemen als de target voldoende eenduidig is.

## 0.4 Ambiguity rule
Voor elke vrije contextvraag:
> Als een ander actief leerwoord uit dezelfde scope logisch in hetzelfde gat past, herschrijf of schrap de vraag.

Liever géén contextoefening dan een dubbelzinnige contextoefening.

## 0.5 Mastery
- Oefenvarianten mappen naar bestaande leerdoelen.
- Geen nieuwe permanente doelen.
- Meer-gatenvragen: elk gat apart beoordelen en evidence registreren.
- Volledige vertaalzin:
  - volledig correct → positieve evidence voor gekoppelde doelen;
  - fout → integratieve vraag fout, maar niet automatisch alle onderliggende doelen negatief bestraffen.

---

# 1. Scope Trajet 6

## Wel digitaal oefenen
1. **Atelier Parole — Décrire une pièce / Situer un objet**
   - Traduire / Vertalen
   - En contexte / In een zin
   - objecten en toestellen
   - kamers beschrijven
   - objecten situeren
2. **Atelier Verbes — Le passé composé avec être**
   - vorming
   - werkwoorden die met `être` vervoegd worden
   - participes passés
   - accord van het participe passé
   - keuze `avoir` / `être` in gemengde herhaling
3. **Chiffres et lettres — De 0 à 100 000**
   - dynamische getaltraining
   - jaartallen
4. **Atelier Grammaire — La question sans / avec mot interrogatif**
   - intonatie zonder vraagwoord
   - intonatie met vraagwoord
   - `est-ce que` zonder vraagwoord
   - `est-ce que` met vraagwoord
   - vraagwoorden
   - `que / quoi`
   - leestekens als vocabulary
5. **Comment écrire ? — a/à, ou/où, la/là**
   - schriftelijke discriminatie
   - géén audio nodig
6. **Révision du trajet 6**
   - integratie van volledige leerstof
   - beperkte herhaling van artikel, négation en adjectif possessif zoals in de Bonne mémoire-pagina

## Niet als aparte digitale module
- **Kiosque — La chanson française**
- **Trivial Pursuit** als boekspel
- **Bonne mémoire ?** als aparte module; inhoud mag wel terugkomen in Révision

---

# 2. Atelier Parole — broninventaris

## 2.1 On se rappelle ? — substantifs
- l’armoire
- l’assiette
- le banc
- le bureau
- la chaise
- la douche
- le fauteuil
- la lampe
- le lit
- la photo
- la table
- le tableau
- la tasse
- la toilette
- les toilettes
- le verre

## 2.2 On se rappelle ? — verbes
- aider
- entrer
- habiter

## 2.3 On se rappelle ? — adjectifs
- beau / belle
- génial(e)
- joli(e)
- pratique

## 2.4 On se rappelle ? — mots invariables
- beaucoup
- dans
- là

## 2.5 On découvre ! — substantifs
- l’appareil
- l’aspirateur
- la baignoire
- le bain
- le barbecue
- la cafetière
- le canapé
- la clim
- le congélateur
- la couette
- le couvert
- la cuisinière
- l’étagère
- l’évier
- le four
- le (four à) micro-ondes
- le frigo
- la friteuse
- la garde-robe
- le lavabo
- le lave-vaisselle
- la machine à laver
- le miroir
- l’ordi(nateur)
- l’oreiller
- le placard
- la poubelle
- le rideau
- le robinet
- la table de nuit
- le tapis
- la télé(vision)
- la télécommande
- le tiroir

## 2.6 On découvre ! — verbes
- dormir
- ranger

## 2.7 On découvre ! — expressions
- en désordre
- équipé(e) de
- dans le coin

---

# 3. Vocabulaire — oefenarchitectuur

## 3.1 Traduire / Vertalen
Bestaande FR↔NL-oefenvorm behouden.

### Belangrijke onderscheidingen
- `la toilette` = wc-pot / toilet zelf
- `les toilettes` = toilet / toiletruimte
- `la baignoire` = badkuip
- `le bain` = bad als activiteit/inhoud: `prendre un bain`
- `l’armoire` = kast
- `la garde-robe` = kleerkast
- `le placard` = (ingemaakte) kast
- `le bureau` is hier het **meubel/bureau**, niet de kamer uit Trajet 5
- `l’ordi(nateur)` accepteert waar passend `ordi` en `ordinateur`
- `la télé(vision)` accepteert `télé` en `télévision`

## 3.2 En contexte / In een zin
- Franse context;
- geen Nederlandse target tussen haakjes;
- context moet één target voldoende afdwingen;
- concrete verbogen vorm mapt terug naar basisitem;
- geen contextoefening gebruiken wanneer `beau/joli/génial` allemaal even logisch kunnen zijn.

---

# 4. Vocabulaire — En contexte bank

## 4.1 On se rappelle ?

| ID | Prompt | Antwoord |
|---|---|---|
| T6-VOC-CTX-001 | Je range mes assiettes dans l’___. | armoire |
| T6-VOC-CTX-002 | Je mange ma soupe dans une ___. | assiette |
| T6-VOC-CTX-003 | Dans le parc, je m’assieds sur un ___. | banc |
| T6-VOC-CTX-004 | Mon ordinateur est sur mon ___. | bureau |
| T6-VOC-CTX-005 | Je m’assieds sur une ___ pour travailler. | chaise |
| T6-VOC-CTX-006 | Je me lave sous la ___. | douche |
| T6-VOC-CTX-007 | Je regarde la télé dans mon ___. | fauteuil |
| T6-VOC-CTX-008 | Il fait noir. J’allume la ___. | lampe |
| T6-VOC-CTX-009 | Je dors dans mon ___. | lit |
| T6-VOC-CTX-010 | Cette ___ de ma famille est sur le mur. | photo |
| T6-VOC-CTX-011 | Nous mangeons autour de la ___. | table |
| T6-VOC-CTX-012 | Ce ___ est accroché au mur. C’est une peinture. | tableau |
| T6-VOC-CTX-013 | Je bois du thé dans une ___. | tasse |
| T6-VOC-CTX-014 | Dans la salle de bains, la ___ est à côté du lavabo. | toilette |
| T6-VOC-CTX-015 | Je dois aller aux ___. | toilettes |
| T6-VOC-CTX-016 | Je bois de l’eau dans un ___. | verre |
| T6-VOC-CTX-017 | Je vais ___ maman à mettre la table. | aider |
| T6-VOC-CTX-018 | La porte est ouverte : tu peux ___. | entrer |
| T6-VOC-CTX-019 | Nous ___ dans un appartement à Lille. | habitons |
| T6-VOC-CTX-020 | Il y a ___ d’appareils dans cette cuisine. | beaucoup |
| T6-VOC-CTX-021 | Les verres sont ___ l’armoire. | dans |
| T6-VOC-CTX-022 | — Où est la télécommande ? — Elle est ___. | là |

Geen vrije contexttarget voor `beau/belle`, `joli(e)`, `génial(e)` wegens sterke overlap in algemene beschrijvingen.
`pratique` wordt in Actes de parole in natuurlijke context geoefend.

## 4.2 On découvre ! — toestellen/meubels

| ID | Prompt | Antwoord |
|---|---|---|
| T6-VOC-CTX-023 | Une cafetière est un ___ pratique. | appareil |
| T6-VOC-CTX-024 | Le sol est sale. Je prends l’___. | aspirateur |
| T6-VOC-CTX-025 | Je m’allonge dans la ___ pour prendre un bain. | baignoire |
| T6-VOC-CTX-026 | Je préfère prendre un ___ plutôt qu’une douche. | bain |
| T6-VOC-CTX-027 | En été, nous préparons la viande sur le ___. | barbecue |
| T6-VOC-CTX-028 | Le matin, je prépare du café avec la ___. | cafetière |
| T6-VOC-CTX-029 | Trois personnes peuvent s’asseoir sur le ___. | canapé |
| T6-VOC-CTX-030 | Il fait très chaud. J’allume la ___. | clim |
| T6-VOC-CTX-031 | Les glaces sont dans le ___. | congélateur |
| T6-VOC-CTX-032 | Quand je dors, je suis sous ma ___. | couette |
| T6-VOC-CTX-033 | La fourchette, le couteau et la cuillère forment le ___. | couvert |
| T6-VOC-CTX-034 | Je prépare la sauce sur la ___. | cuisinière |
| T6-VOC-CTX-035 | Je range mes livres sur l’___. | étagère |
| T6-VOC-CTX-036 | Je lave les légumes dans l’___. | évier |
| T6-VOC-CTX-037 | Je prépare une pizza dans le ___. | four |
| T6-VOC-CTX-038 | Je réchauffe mon repas rapidement dans le ___. | micro-ondes |
| T6-VOC-CTX-039 | Le lait et le fromage sont dans le ___. | frigo |
| T6-VOC-CTX-040 | Je prépare des frites dans la ___. | friteuse |
| T6-VOC-CTX-041 | Je range mes vêtements dans la ___. | garde-robe |
| T6-VOC-CTX-042 | Je me lave les mains au ___. | lavabo |
| T6-VOC-CTX-043 | Les assiettes sales vont dans le ___. | lave-vaisselle |
| T6-VOC-CTX-044 | Mes vêtements sales vont dans la ___. | machine à laver |
| T6-VOC-CTX-045 | Je regarde mon visage dans le ___. | miroir |
| T6-VOC-CTX-046 | Je fais mes devoirs sur mon ___. | ordinateur |
| T6-VOC-CTX-047 | Je pose ma tête sur l’___ pour dormir. | oreiller |
| T6-VOC-CTX-048 | Dans la chambre de mes parents, il y a un grand ___ intégré dans le mur. | placard |
| T6-VOC-CTX-049 | Je jette les déchets dans la ___. | poubelle |
| T6-VOC-CTX-050 | Il fait nuit. Nous fermons les ___. | rideaux |
| T6-VOC-CTX-051 | J’ouvre le ___ pour faire couler l’eau. | robinet |
| T6-VOC-CTX-052 | Ma lampe et mon réveil sont sur la ___. | table de nuit |
| T6-VOC-CTX-053 | Il y a un grand ___ rouge sur le sol. | tapis |
| T6-VOC-CTX-054 | Nous regardons un film sur la ___. | télé |
| T6-VOC-CTX-055 | Je change de chaîne avec la ___. | télécommande |
| T6-VOC-CTX-056 | Les couverts sont dans le premier ___. | tiroir |

## 4.3 Verbes/expressions

| ID | Prompt | Antwoord |
|---|---|---|
| T6-VOC-CTX-057 | La nuit, je ___ huit heures. | dors |
| T6-VOC-CTX-058 | Ma chambre est en désordre. Je dois la ___. | ranger |
| T6-VOC-CTX-059 | Il y a des vêtements partout. La chambre est ___. | en désordre |
| T6-VOC-CTX-060 | Cette cuisine a un four, un lave-vaisselle et un grand frigo. Elle est bien ___. | équipée |
| T6-VOC-CTX-061 | La plante est tout au bout de la chambre, ___. | dans le coin |

---

# 5. Actes de parole — Décrire une pièce

De bestaande phrase-items blijven de permanente targets.
Onderstaande items zijn situationele oefenvarianten.

| ID | Situatie | Verwacht antwoord |
|---|---|---|
| T6-ACT-DESC-001 | Begin: Ik toon jullie mijn kamer. | Je vous montre ma chambre. |
| T6-ACT-DESC-002 | Zeg: En hier is mijn kamer. | Et voici ma chambre. |
| T6-ACT-DESC-003 | Begin je beschrijving: Eerst is er mijn bed. | D’abord, il y a mon lit. |
| T6-ACT-DESC-004 | Zeg: Mijn bureau staat tegenover het bed. | Mon bureau se trouve en face du lit. |
| T6-ACT-DESC-005 | Zeg: In de kast leg ik mijn kleren. | Dans l’armoire, je mets mes vêtements. |
| T6-ACT-DESC-006 | Zeg: Er is ook een lamp. | Il y a aussi une lampe. |
| T6-ACT-DESC-007 | Zeg: Op het bureau staat een computer. | Sur le bureau, il y a un ordinateur. |
| T6-ACT-DESC-008 | Zeg: Daar links staat een tv. | Là, à gauche, il y a une télé. |
| T6-ACT-DESC-009 | Zeg: Rechts staat een kleine tafel. | À droite, il y a une petite table. |
| T6-ACT-DESC-010 | Zeg: Ik heb airco in mijn kamer. | J’ai la clim dans ma chambre. |
| T6-ACT-DESC-011 | Zeg: De muren zijn blauw geschilderd. | Les murs sont peints en bleu. |
| T6-ACT-DESC-012 | Zeg: De kamer is goed uitgerust. | Elle est bien équipée. |
| T6-ACT-DESC-013 | Reageer: Wat een leuke ruimte, niet? | Quel chouette espace, non ? |
| T6-ACT-DESC-014 | Reageer: Hij is groot, ik hou ervan. | Il est grand, j’adore ! |
| T6-ACT-DESC-015 | Zeg: Ik vind mijn bureau leuk, het is mooi. | J’aime bien mon bureau, il est beau. |
| T6-ACT-DESC-016 | Reageer: Leuk, niet? | Chouette, non ? |
| T6-ACT-DESC-017 | Zeg: Ik vind ze mooi. | Elle est belle, je trouve. |
| T6-ACT-DESC-018 | Zeg: Ik kan dus in mijn kamer spelen. | Je peux donc jouer dans ma chambre. |
| T6-ACT-DESC-019 | Reageer: Dat is praktisch. | C’est pratique. |
| T6-ACT-DESC-020 | Zeg: Mijn kamer is geweldig. | Elle est géniale, ma chambre. |
| T6-ACT-DESC-021 | Zeg: Ik ben heel tevreden. | Je suis très content(e). |

### Kleuren
De bronphrase bevat:
`rouge / vert / jaune / bleu / brun / orange / blanc / gris / mauve / noir`.

Deze kleuren worden als varianten binnen hetzelfde phrase-doel gebruikt.
Ze worden niet automatisch 10 nieuwe permanente vocab-items.

---

# 6. Actes de parole — Situer un objet

| ID | Situatie | Verwacht antwoord |
|---|---|---|
| T6-ACT-OBJ-001 | Vraag waar de koelkast is. | Le frigo, il est où ? |
| T6-ACT-OBJ-002 | Vraag waar de PlayStation is. | La PlayStation, elle est où ? |
| T6-ACT-OBJ-003 | Zeg: Ik zie de koelkast. | Je vois le frigo. |
| T6-ACT-OBJ-004 | Vraag waar de borden zijn. | Les assiettes sont où ? |
| T6-ACT-OBJ-005 | Vraag waar het bestek zich bevindt. | Les couverts se trouvent où ? |
| T6-ACT-OBJ-006 | Reageer: Ah ja! | Ah oui ! |
| T6-ACT-OBJ-007 | Vraag waar de boter is. | Où est le beurre ? |
| T6-ACT-OBJ-008 | Vraag waar de glazen zijn. | Où se trouvent les verres ? |
| T6-ACT-OBJ-009 | Reageer: Gevonden! | Trouvé ! |
| T6-ACT-OBJ-010 | Zeg: Ik vind de tassen niet. | Je ne trouve pas les tasses. |
| T6-ACT-OBJ-011 | Zeg: Naast de deur. | À côté de la porte. |
| T6-ACT-OBJ-012 | Zeg: Ze staat links van de tv. | Elle est à gauche de la télé. |
| T6-ACT-OBJ-013 | Zeg: Ze staan rechts van de glazen. | Elles se trouvent à droite des verres. |
| T6-ACT-OBJ-014 | Zeg: Ze liggen in de eerste lade. | Ils sont dans le premier tiroir. |
| T6-ACT-OBJ-015 | Zeg: Hij ligt op tafel, niet? | Il se trouve sur la table, non ? |
| T6-ACT-OBJ-016 | Zeg: Ze staan in het midden van de kast. | Ils sont au milieu de l’armoire. |
| T6-ACT-OBJ-017 | Vraag: Zie je? | Tu vois ? |
| T6-ACT-OBJ-018 | Zeg: In de kast rechts van de koelkast. | Dans l’armoire à droite du frigo. |

### Opmerking over `se trouver`
De cursus gebruikt `se trouve / se trouvent` frequent.
Dit wordt als vaste taalstructuur binnen Actes de parole geoefend.
Geen nieuw permanent werkwoorddoel aanmaken.

---

# 7. Atelier Verbes — Le passé composé avec être

## 7.1 Permanente grammar targets
1. vorming: `être` in indicatif présent + participe passé
2. deze bewegings-/toestandswerkwoorden gebruiken `être`
3. accord: participe passé komt overeen met onderwerp
4. gemengde groep met minstens één man → masculin pluriel

### Participes passés uit de cursus
- monter → monté
- arriver → arrivé
- aller → allé
- rester → resté
- tomber → tombé
- (r)entrer → (r)entré
- naître → né
- descendre → descendu
- partir → parti
- venir → venu
- passer → passé
- retourner → retourné
- sortir → sorti
- mourir → mort

## 7.2 Bronregel
Bij `être` past het participe passé zich aan:
- masculin singulier: geen extra letter
- féminin singulier: `+ e`
- masculin pluriel: `+ s`
- féminin pluriel: `+ es`

Gemengde groep met minstens één man:
→ masculin pluriel.

---

# 8. Participes passés — basisvorm

| ID | Vraag | Antwoord |
|---|---|---|
| T6-PP-ETRE-001 | monter → participe passé | monté |
| T6-PP-ETRE-002 | arriver → participe passé | arrivé |
| T6-PP-ETRE-003 | aller → participe passé | allé |
| T6-PP-ETRE-004 | rester → participe passé | resté |
| T6-PP-ETRE-005 | tomber → participe passé | tombé |
| T6-PP-ETRE-006 | rentrer → participe passé | rentré |
| T6-PP-ETRE-007 | entrer → participe passé | entré |
| T6-PP-ETRE-008 | naître → participe passé | né |
| T6-PP-ETRE-009 | descendre → participe passé | descendu |
| T6-PP-ETRE-010 | partir → participe passé | parti |
| T6-PP-ETRE-011 | venir → participe passé | venu |
| T6-PP-ETRE-012 | passer → participe passé | passé |
| T6-PP-ETRE-013 | retourner → participe passé | retourné |
| T6-PP-ETRE-014 | sortir → participe passé | sorti |
| T6-PP-ETRE-015 | mourir → participe passé | mort |

Deze basisvormvragen meten het participium zelf.
Accord wordt in aparte zinnen gemeten.

---

# 9. Passé composé avec être — contextbank

## 9.1 Masculin singulier

| ID | Vraag | Antwoord |
|---|---|---|
| T6-PC-ETRE-001 | Samuel ___ hier soir. (partir) | est parti |
| T6-PC-ETRE-002 | Lucas ___ à huit heures. (arriver) | est arrivé |
| T6-PC-ETRE-003 | Hugo ___ en ville. (aller) | est allé |
| T6-PC-ETRE-004 | Marc ___ à la maison. (rester) | est resté |
| T6-PC-ETRE-005 | Tom ___ dans l’escalier. (tomber) | est tombé |
| T6-PC-ETRE-006 | Nicolas ___ chez lui à minuit. (rentrer) | est rentré |
| T6-PC-ETRE-007 | Le garçon ___ dans la classe. (entrer) | est entré |
| T6-PC-ETRE-008 | Liam ___ le 5 avril. (naître) | est né |
| T6-PC-ETRE-009 | Papa ___ du train. (descendre) | est descendu |
| T6-PC-ETRE-010 | Mon cousin ___ en bus. (venir) | est venu |
| T6-PC-ETRE-011 | Paul ___ devant l’école. (passer) | est passé |
| T6-PC-ETRE-012 | Mon père ___ à Bruxelles. (retourner) | est retourné |
| T6-PC-ETRE-013 | Lucas ___ samedi soir. (sortir) | est sorti |
| T6-PC-ETRE-014 | Le grand-père de Jules ___ en 2005. (mourir) | est mort |
| T6-PC-ETRE-015 | Hugo ___ au premier étage. (monter) | est monté |

## 9.2 Féminin singulier

| ID | Vraag | Antwoord |
|---|---|---|
| T6-PC-ETRE-016 | Emma ___ hier soir. (partir) | est partie |
| T6-PC-ETRE-017 | Lina ___ à huit heures. (arriver) | est arrivée |
| T6-PC-ETRE-018 | Sarah ___ en ville. (aller) | est allée |
| T6-PC-ETRE-019 | Julie ___ à la maison. (rester) | est restée |
| T6-PC-ETRE-020 | Lola ___ dans l’escalier. (tomber) | est tombée |
| T6-PC-ETRE-021 | Marie ___ chez elle à minuit. (rentrer) | est rentrée |
| T6-PC-ETRE-022 | La fille ___ dans la classe. (entrer) | est entrée |
| T6-PC-ETRE-023 | Victoria ___ le 14 avril. (naître) | est née |
| T6-PC-ETRE-024 | Maman ___ du train. (descendre) | est descendue |
| T6-PC-ETRE-025 | Ma cousine ___ en bus. (venir) | est venue |
| T6-PC-ETRE-026 | Julie ___ devant l’école. (passer) | est passée |
| T6-PC-ETRE-027 | Ma mère ___ à Bruxelles. (retourner) | est retournée |
| T6-PC-ETRE-028 | Emma ___ samedi soir. (sortir) | est sortie |
| T6-PC-ETRE-029 | La grand-mère de Jules ___ en 2005. (mourir) | est morte |
| T6-PC-ETRE-030 | Sarah ___ au premier étage. (monter) | est montée |

## 9.3 Pluriel / accord

| ID | Vraag | Antwoord |
|---|---|---|
| T6-PC-AGR-001 | Lucas et Hugo ___ en ville. (aller) | sont allés |
| T6-PC-AGR-002 | Emma et Sarah ___ en ville. (aller) | sont allées |
| T6-PC-AGR-003 | Lucas et Emma ___ en ville. (aller) | sont allés |
| T6-PC-AGR-004 | Les garçons ___ à huit heures. (arriver) | sont arrivés |
| T6-PC-AGR-005 | Les filles ___ à huit heures. (arriver) | sont arrivées |
| T6-PC-AGR-006 | Mes parents ___ tard. (rentrer) | sont rentrés |
| T6-PC-AGR-007 | Maman et ma sœur ___ tard. (rentrer) | sont rentrées |
| T6-PC-AGR-008 | Mon frère et ma sœur ___ tard. (rentrer) | sont rentrés |
| T6-PC-AGR-009 | Les garçons ___ dans l’escalier. (tomber) | sont tombés |
| T6-PC-AGR-010 | Les filles ___ dans l’escalier. (tomber) | sont tombées |
| T6-PC-AGR-011 | Mes cousins ___ de Lille. (venir) | sont venus |
| T6-PC-AGR-012 | Mes cousines ___ de Lille. (venir) | sont venues |
| T6-PC-AGR-013 | Jules, Fatima et Olga ___ à Charleroi. (descendre) | sont descendus |
| T6-PC-AGR-014 | Léa et Manon ___ au café. (entrer) | sont entrées |
| T6-PC-AGR-015 | Paul et Julie ___ après minuit. (sortir) | sont sortis |
| T6-PC-AGR-016 | Les sœurs de Lucas ___ à la maison. (rester) | sont restées |

### Microfeedback accord
- `Emma` → féminin → `arrivée`
- `Emma et Sarah` → féminin pluriel → `arrivées`
- `Lucas et Emma` → gemengd → masculin pluriel → `arrivés`

---

# 10. Avoir ou être ? — gemengde herhaling

Deze bank herhaalt T5 + T6.
Doel: herkennen welk hulpwerkwoord nodig is.

| ID | Vraag | Antwoord |
|---|---|---|
| T6-AUX-MIX-001 | Hier, j’___ un film. (regarder) | ai regardé |
| T6-AUX-MIX-002 | Hier, Emma ___ en ville. (aller) | est allée |
| T6-AUX-MIX-003 | Nous ___ des photos. (prendre) | avons pris |
| T6-AUX-MIX-004 | Lucas ___ à huit heures. (arriver) | est arrivé |
| T6-AUX-MIX-005 | Elles ___ leur chambre. (ranger) | ont rangé |
| T6-AUX-MIX-006 | Elles ___ à huit heures. (arriver) | sont arrivées |
| T6-AUX-MIX-007 | Mes parents ___ la voiture. (vendre) | ont vendu |
| T6-AUX-MIX-008 | Mes parents ___ à Bruxelles. (partir) | sont partis |
| T6-AUX-MIX-009 | Julie ___ une pizza. (manger) | a mangé |
| T6-AUX-MIX-010 | Julie ___ du train. (descendre) | est descendue |
| T6-AUX-MIX-011 | Les garçons ___ au foot. (jouer) | ont joué |
| T6-AUX-MIX-012 | Les garçons ___ après minuit. (rentrer) | sont rentrés |
| T6-AUX-MIX-013 | Nous ___ à Liège. (être) | avons été |
| T6-AUX-MIX-014 | Nous ___ à Liège à huit heures. (arriver) | sommes arrivés |
| T6-AUX-MIX-015 | Sarah ___ son sac. (mettre) | a mis |
| T6-AUX-MIX-016 | Sarah ___ dans la classe. (entrer) | est entrée |

In `Apprendre` mag de module labelen:
- `avec avoir`
- `avec être`

In `Se tester` kan dit label verdwijnen.

---

# 11. Tijdenlijn — passé composé / passé récent / présent / futur proche

Gebruik alleen eenduidige tijdscontext.

| ID | Vraag | Antwoord |
|---|---|---|
| T6-TENSE-MIX-001 | Hier matin, Jessica ___ en avion. (partir) | est partie |
| T6-TENSE-MIX-002 | Jessica sort juste de chez elle : elle ___ de partir. (partir) | vient |
| T6-TENSE-MIX-003 | Maintenant, Jessica ___ à l’aéroport. (être) | est |
| T6-TENSE-MIX-004 | Dans une heure, Jessica ___ pour Rome. (partir) | va partir |
| T6-TENSE-MIX-005 | Samedi dernier, nous ___ à Bruxelles. (aller) | sommes allés |
| T6-TENSE-MIX-006 | Nous revenons tout juste : nous ___ de Bruxelles. (revenir) | venons |
| T6-TENSE-MIX-007 | Aujourd’hui, nous ___ à la maison. (rester) | restons |
| T6-TENSE-MIX-008 | Demain, nous ___ à Lille. (aller) | allons aller |

Bij passé récent is het volledige doel:
- `vient de partir`
- `venons de revenir`
Technisch niet enkel het hulpwerkwoord scoren wanneer de leerling de volledige constructie moet typen.

---

# 12. Chiffres et lettres — De 0 à 100 000

## 12.1 Permanente mastery
Er is **één bestaand number_spec-item** voor 0–100 000.
Maak geen 100 001 permanente number-items.

## 12.2 Oefenvormen

### Lettres → chiffres — primair
`septante-huit-mille-huit-cent-quatorze → 78 814`

### Chiffres → lettres — secundair
`15 115 → quinze-mille-cent-quinze`

### Context
- jaartallen
- prijzen
- bezoekersaantallen
- afstanden/hoogtes
- inwonersaantallen
- eenvoudige nummerreeksen

## 12.3 Belgische hoofdvormen
Primair:
- `septante`
- `nonante`

Franse regionale alternatieven worden als correct geaccepteerd:
- `soixante-dix...`
- `quatre-vingt-dix...`

## 12.4 Duizendtallen
Voorbeelden uit de cursusstructuur:
- 1000 → mille
- 1100 → mille-cent
- 1101 → mille-cent-un
- 2000 → deux-mille
- 2400 → deux-mille-quatre-cents
- 2500 → deux-mille-cinq-cents
- 5000 → cinq-mille
- 10 000 → dix-mille
- 11 000 → onze-mille
- 15 115 → quinze-mille-cent-quinze
- 78 814 → septante-huit-mille-huit-cent-quatorze

`mille` krijgt nooit een `s`.

## 12.5 Honderdtallen
- 200 → `deux-cents`
- 201 → `deux-cent-un`
- 2400 → `deux-mille-quatre-cents`
- 2401 → `deux-mille-quatre-cent-un`

`cent` krijgt alleen `s` als het vermenigvuldigd wordt en er niets meer achter volgt.

## 12.6 Jaartallen
Bronregel:
- vóór 2000 mag de cursusvorm het jaartal in twee delen uitdrukken met `cent`
  - 1999 → `dix-neuf-cent-nonante-neuf`
  - 1746 → `dix-sept-cent-quarante-six`
- vanaf 2000:
  - 2025 → `deux-mille-vingt-cinq`
  - 2008 → `deux-mille-huit`

De bron vermeldt dat ook een vorm vanaf `mille` mogelijk is voor oudere jaartallen.
Accepteer daarom waar ondersteund een klassieke volledige getalvorm als alternatief, maar toon de cursusvorm primair.

## 12.7 Sampling
Balanceer over:
- 0–999
- 1000–9999
- 10 000–49 999
- 50 000–100 000
- aparte jaartalvragen

---

# 13. Atelier Grammaire — La question

## 13.1 Permanente grammar targets

### Intonation
1. zonder vraagwoord:
   `Sujet + verbe + ?`
   - Tu aimes la France ?
2. met vraagwoord:
   `Sujet + verbe + mot interrogatif + ?`
   - On va où ?

### Est-ce que
3. zonder vraagwoord:
   `Est-ce que + sujet + verbe + ?`
   - Est-ce que tu joues au basket ?
4. met vraagwoord:
   `Mot interrogatif + est-ce que + sujet + verbe + ?`
   - Pourquoi est-ce que tu aimes le foot ?

### Que / quoi
5. `quoi` na het werkwoord
   - Tu fais quoi ?
6. `que` vóór `est-ce que`
   - Qu’est-ce que tu fais ?

### Vraagwoorden
- qui
- quoi
- quand
- où
- comment
- combien (de)
- pourquoi
- quel(le)(s)
- à quelle heure

---

# 14. Vraagwoorden — betekenisbank

| ID | Vraag | Antwoord |
|---|---|---|
| T6-QW-MEAN-001 | `qui` betekent ... | wie |
| T6-QW-MEAN-002 | `quoi` betekent ... | wat |
| T6-QW-MEAN-003 | `quand` betekent ... | wanneer |
| T6-QW-MEAN-004 | `où` betekent ... | waar |
| T6-QW-MEAN-005 | `comment` betekent ... | hoe |
| T6-QW-MEAN-006 | `combien (de)` betekent ... | hoeveel |
| T6-QW-MEAN-007 | `pourquoi` betekent ... | waarom |
| T6-QW-MEAN-008 | `quel / quelle / quels / quelles` betekent ... | welk / welke |
| T6-QW-MEAN-009 | `à quelle heure` betekent ... | hoe laat |

---

# 15. Kies het juiste vraagwoord

| ID | Vraag | Antwoord |
|---|---|---|
| T6-QW-CTX-001 | — ___ est le Roi-Soleil ? — Louis XIV. | Qui |
| T6-QW-CTX-002 | — Tu manges ___ ? — Une pizza. | quoi |
| T6-QW-CTX-003 | — On dîne ___ ? — À midi. | quand |
| T6-QW-CTX-004 | — Tu habites ___ ? — À Lille. | où |
| T6-QW-CTX-005 | — Tu vas à l’école ___ ? — À vélo. | comment |
| T6-QW-CTX-006 | — Vous restez ___ jours ? — Dix jours. | combien de |
| T6-QW-CTX-007 | — ___ est-ce que tu aimes le foot ? — Parce que c’est chouette. | Pourquoi |
| T6-QW-CTX-008 | — ___ est ton sport préféré ? — Le tennis. | Quel |
| T6-QW-CTX-009 | — ___ est ta couleur préférée ? — Le bleu. | Quelle |
| T6-QW-CTX-010 | — ___ sont tes hobbies ? — Le tennis et le padel. | Quels |
| T6-QW-CTX-011 | — ___ est-ce que le train arrive ? — À 17 h 30. | À quelle heure |
| T6-QW-CTX-012 | — Tu as ___ frères et sœurs ? — Deux. | combien de |
| T6-QW-CTX-013 | — Tu t’appelles ___ ? — Lucas. | comment |
| T6-QW-CTX-014 | — Ton anniversaire, c’est ___ ? — Le 15 avril. | quand |
| T6-QW-CTX-015 | — ___ sont tes chaussures ? — Les rouges. | Quelles |

---

# 16. Question avec intonation — sans mot interrogatif

Objectif: transformer une phrase déclarative en question sans changer l’ordre des mots.

| ID | Phrase | Question |
|---|---|---|
| T6-Q-INT-001 | Tu aimes la France. | Tu aimes la France ? |
| T6-Q-INT-002 | Tu joues au basket. | Tu joues au basket ? |
| T6-Q-INT-003 | Vous avez quatorze ans. | Vous avez quatorze ans ? |
| T6-Q-INT-004 | Elle habite à Lille. | Elle habite à Lille ? |
| T6-Q-INT-005 | Ils parlent français. | Ils parlent français ? |
| T6-Q-INT-006 | Tu as un frère. | Tu as un frère ? |
| T6-Q-INT-007 | Vous partez en vacances. | Vous partez en vacances ? |
| T6-Q-INT-008 | Emma aime le sport. | Emma aime le sport ? |

Le point d’interrogation doit être présent dans les exercices de phrase complète.

---

# 17. Question avec intonation — avec mot interrogatif

| ID | Cue | Antwoord |
|---|---|---|
| T6-Q-INTW-001 | Vraag waar iemand woont met intonatie. | Tu habites où ? |
| T6-Q-INTW-002 | Vraag hoe iemand heet met intonatie. | Tu t’appelles comment ? |
| T6-Q-INTW-003 | Vraag wat iemand eet met intonatie. | Tu manges quoi ? |
| T6-Q-INTW-004 | Vraag wanneer iemand vertrekt met intonatie. | Tu pars quand ? |
| T6-Q-INTW-005 | Vraag hoeveel broers en zussen iemand heeft. | Tu as combien de frères et sœurs ? |
| T6-Q-INTW-006 | Vraag welk sport iemand doet. | Tu fais quel sport ? |
| T6-Q-INTW-007 | Vraag hoe laat de trein aankomt. | Le train arrive à quelle heure ? |
| T6-Q-INTW-008 | Vraag wie de persoon is. | C’est qui ? |

---

# 18. Question avec est-ce que — sans mot interrogatif

| ID | Phrase | Question |
|---|---|---|
| T6-Q-ECQ-001 | Tu joues au basket. | Est-ce que tu joues au basket ? |
| T6-Q-ECQ-002 | Tu aimes danser. | Est-ce que tu aimes danser ? |
| T6-Q-ECQ-003 | Vous partez en vacances. | Est-ce que vous partez en vacances ? |
| T6-Q-ECQ-004 | Il habite à Bruxelles. | Est-ce qu’il habite à Bruxelles ? |
| T6-Q-ECQ-005 | Elle aime le français. | Est-ce qu’elle aime le français ? |
| T6-Q-ECQ-006 | Ils ont un chien. | Est-ce qu’ils ont un chien ? |
| T6-Q-ECQ-007 | On va au cinéma. | Est-ce qu’on va au cinéma ? |
| T6-Q-ECQ-008 | Emma joue au tennis. | Est-ce qu’Emma joue au tennis ? |

Normaliseer `est-ce qu’` vóór klinker.

---

# 19. Question avec est-ce que — avec mot interrogatif

| ID | Cue | Antwoord |
|---|---|---|
| T6-Q-ECQW-001 | Vraag waarom iemand van voetbal houdt. | Pourquoi est-ce que tu aimes le foot ? |
| T6-Q-ECQW-002 | Vraag wanneer men eet in Frankrijk. | Quand est-ce qu’on dîne en France ? |
| T6-Q-ECQW-003 | Vraag waar iemand op vakantie gaat. | Où est-ce que tu pars en vacances ? |
| T6-Q-ECQW-004 | Vraag hoe iemand naar school gaat. | Comment est-ce que tu vas à l’école ? |
| T6-Q-ECQW-005 | Vraag hoeveel uren iemand per nacht slaapt. | Combien d’heures est-ce que tu dors par nuit ? |
| T6-Q-ECQW-006 | Vraag welk sport iemand het liefst doet. | Quel sport est-ce que tu préfères ? |
| T6-Q-ECQW-007 | Vraag hoe laat de trein aankomt. | À quelle heure est-ce que le train arrive ? |
| T6-Q-ECQW-008 | Vraag wie er in Lille woont. | Qui est-ce qui habite à Lille ? |

### Opmerking T6-Q-ECQW-008
`qui est-ce qui` gaat verder dan de eenvoudige kernregel in de tabel.
Gebruik deze variant **niet als kernitem** tenzij de bronimplementatie deze constructie expliciet ondersteunt.
Voor de definitieve standaardbank vervangen door:
`Vraag wie jij ziet. → Qui est-ce que tu vois ?`

Definitieve T6-Q-ECQW-008:
`Qui est-ce que tu vois ?`

---

# 20. Que / quoi

| ID | Vraag | Antwoord |
|---|---|---|
| T6-Q-QQ-001 | Tu fais ___ ? | quoi |
| T6-Q-QQ-002 | Tu manges ___ ? | quoi |
| T6-Q-QQ-003 | ___ est-ce que tu fais ? | Qu’ |
| T6-Q-QQ-004 | ___ est-ce que tu manges ? | Qu’ |
| T6-Q-QQ-005 | `Tu fais quoi ?` → formuleer met est-ce que. | Qu’est-ce que tu fais ? |
| T6-Q-QQ-006 | `Qu’est-ce que tu regardes ?` → formuleer met intonatie. | Tu regardes quoi ? |
| T6-Q-QQ-007 | `Tu veux quoi ?` → formuleer met est-ce que. | Qu’est-ce que tu veux ? |
| T6-Q-QQ-008 | `Qu’est-ce que vous mangez ?` → formuleer met intonatie. | Vous mangez quoi ? |

Technisch:
- voor de gaten 003–004 kan het doel intern als `que`-regel worden gemapt;
- UI toont de correcte elisie `Qu’`.

---

# 21. Dezelfde vraag op twee manieren

| ID | Basis | Antwoord 1 | Antwoord 2 |
|---|---|---|---|
| T6-Q-DOUBLE-001 | Je vraagt wanneer iemand een match heeft. | Tu as un match quand ? | Quand est-ce que tu as un match ? |
| T6-Q-DOUBLE-002 | Je vraagt welke sport iemand leuk vindt. | Tu aimes quel sport ? | Quel sport est-ce que tu aimes ? |
| T6-Q-DOUBLE-003 | Je vraagt waar iemand op vakantie gaat. | Tu pars en vacances où ? | Où est-ce que tu pars en vacances ? |
| T6-Q-DOUBLE-004 | Je vraagt hoeveel uren iemand slaapt. | Tu dors combien d’heures par nuit ? | Combien d’heures est-ce que tu dors par nuit ? |
| T6-Q-DOUBLE-005 | Je vraagt waarom iemand fruit eet. | Tu manges des fruits pourquoi ? | Pourquoi est-ce que tu manges des fruits ? |
| T6-Q-DOUBLE-006 | Je vraagt wat iemand eet. | Tu manges quoi ? | Qu’est-ce que tu manges ? |

Bij natuurlijke Franse productie:
- accepteer alleen de twee structuren die de les expliciet inoefent;
- geen inversievraag als automatische derde vorm toevoegen.

---

# 22. Leestekens — vocabulary

De 11 leestekenitems blijven gewone vocabulary-items.

| ID | Prompt | Antwoord |
|---|---|---|
| T6-SIGN-001 | Een gewone zin eindigt vaak met `.`. Dit teken heet ... | le point |
| T6-SIGN-002 | Een vraag eindigt met `?`. Dit teken heet ... | le point d’interrogation |
| T6-SIGN-003 | Een uitroep eindigt met `!`. Dit teken heet ... | le point d’exclamation |
| T6-SIGN-004 | Het teken `,` heet ... | la virgule |
| T6-SIGN-005 | Het teken `;` heet ... | le point-virgule |
| T6-SIGN-006 | Het teken `...` heet ... | les points de suspension |
| T6-SIGN-007 | Het teken `—` heet ... | le tiret |
| T6-SIGN-008 | Het teken `-` in een samengesteld woord heet ... | le trait d’union |
| T6-SIGN-009 | De tekens `( )` heten ... | les parenthèses |
| T6-SIGN-010 | De tekens `[ ]` heten ... | les crochets |
| T6-SIGN-011 | Het teken `'` heet ... | l’apostrophe |

Deze bank is inhoudelijk geschikt voor digitaal oefenen en vereist geen audio.

---

# 23. Comment écrire ? — a / à

## 23.1 Kern
- `a` = vorm van `avoir`
- `à` = voorzetsel

| ID | Vraag | Antwoord |
|---|---|---|
| T6-HOM-A-001 | Il ___ deux mamans. | a |
| T6-HOM-A-002 | Elle ___ treize ans. | a |
| T6-HOM-A-003 | Mon frère ___ un vélo. | a |
| T6-HOM-A-004 | Je vais ___ Wavre. | à |
| T6-HOM-A-005 | Elle habite ___ Bruxelles. | à |
| T6-HOM-A-006 | Nous allons ___ vélo. | à |
| T6-HOM-A-007 | Lucas ___ un appartement ___ Lille. | a · à |
| T6-HOM-A-008 | Ma sœur ___ rendez-vous ___ huit heures. | a · à |

---

# 24. Comment écrire ? — ou / où

## 24.1 Kern
- `ou` = of
- `où` = waar

| ID | Vraag | Antwoord |
|---|---|---|
| T6-HOM-OU-001 | Tu prends du café ___ du thé ? | ou |
| T6-HOM-OU-002 | Tu préfères le bus ___ le train ? | ou |
| T6-HOM-OU-003 | Tu habites ___ ? | où |
| T6-HOM-OU-004 | ___ est la télécommande ? | Où |
| T6-HOM-OU-005 | On va à pied ___ à vélo ? | ou |
| T6-HOM-OU-006 | Tu sais ___ est la gare ? | où |
| T6-HOM-OU-007 | Tu vas ___ : à Paris ___ à Lille ? | où · ou |
| T6-HOM-OU-008 | Je ne sais pas ___ il habite. | où |

---

# 25. Comment écrire ? — la / là

## 25.1 Kern
- `la` = bepaald lidwoord
- `là` = daar

| ID | Vraag | Antwoord |
|---|---|---|
| T6-HOM-LA-001 | C’est ___ voiture de maman. | la |
| T6-HOM-LA-002 | Je vois ___ maison. | la |
| T6-HOM-LA-003 | ___ cuisine est à gauche. | La |
| T6-HOM-LA-004 | Ma sœur est ___. | là |
| T6-HOM-LA-005 | Le sac est ___, sur la chaise. | là |
| T6-HOM-LA-006 | Regarde ___ : la gare est juste devant nous. | là |
| T6-HOM-LA-007 | ___ voiture est ___, devant la maison. | La · là |
| T6-HOM-LA-008 | ___ pharmacie ? Elle est juste ___. | La · là |

---

# 26. Révision du trajet 6

Aparte tegel:
**Révision du trajet**
*Alles door elkaar*

Combineert:
- kamer/objecten;
- Décrire une pièce;
- Situer un objet;
- passé composé avec être;
- accord;
- avoir/être;
- nombres 0–100 000;
- vragen;
- leestekens;
- a/à, ou/où, la/là;
- beperkte herhaling van artikelen, negatie en possessieven zoals in de Bonne mémoire-pagina.

---

# 27. Révision — volledige zinnen NL → FR

| ID | Nederlands | Correct Frans |
|---|---|---|
| T6-REV-001 | Mijn bureau staat tegenover mijn bed. | Mon bureau se trouve en face de mon lit. |
| T6-REV-002 | De afstandsbediening ligt in de lade. | La télécommande se trouve dans le tiroir. |
| T6-REV-003 | De glazen staan rechts van de borden. | Les verres sont à droite des assiettes. |
| T6-REV-004 | Mijn kamer is goed uitgerust. | Ma chambre est bien équipée. |
| T6-REV-005 | Emma is gisteren naar Lille gegaan. | Emma est allée à Lille hier. |
| T6-REV-006 | Lucas is om acht uur aangekomen. | Lucas est arrivé à huit heures. |
| T6-REV-007 | Emma en Sarah zijn laat thuisgekomen. | Emma et Sarah sont rentrées tard. |
| T6-REV-008 | Lucas en Emma zijn gevallen. | Lucas et Emma sont tombés. |
| T6-REV-009 | Waar woon je? | Tu habites où ? |
| T6-REV-010 | Waarom hou je van voetbal? | Pourquoi est-ce que tu aimes le foot ? |
| T6-REV-011 | Hoe laat komt de trein aan? | À quelle heure est-ce que le train arrive ? |
| T6-REV-012 | Wat eet je? | Tu manges quoi ? / Qu’est-ce que tu manges ? |
| T6-REV-013 | Ik ga met de fiets naar school. | Je vais à l’école à vélo. |
| T6-REV-014 | Mijn zus is daar, rechts. | Ma sœur est là, à droite. |
| T6-REV-015 | Neem je koffie of thee? | Tu prends du café ou du thé ? |

---

# 28. Révision — gemengde invulzinnen

| ID | Vraag | Antwoord(en) |
|---|---|---|
| T6-REV-016 | La cafetière est un ___ pratique. | appareil |
| T6-REV-017 | Je change de chaîne avec la ___. | télécommande |
| T6-REV-018 | Emma ___ hier soir. (sortir) | est sortie |
| T6-REV-019 | Lucas et Emma ___ tard. (rentrer) | sont rentrés |
| T6-REV-020 | Les filles ___ à huit heures. (arriver) | sont arrivées |
| T6-REV-021 | Tu habites ___ ? | où |
| T6-REV-022 | ___ est-ce que tu aimes le foot ? | Pourquoi |
| T6-REV-023 | Tu fais ___ ? | quoi |
| T6-REV-024 | Il ___ un vélo et il va ___ l’école. | a · à |
| T6-REV-025 | ___ voiture est ___, devant la maison. | La · là |

---

# 29. Révision — nombres

| ID | Vraag | Antwoord |
|---|---|---|
| T6-REV-026 | Écris `quinze-mille-cent-quinze` en chiffres. | 15 115 |
| T6-REV-027 | Écris 78 814 en lettres. | septante-huit-mille-huit-cent-quatorze |
| T6-REV-028 | Écris 10 000 en lettres. | dix-mille |
| T6-REV-029 | Écris l’année 1999 selon la forme du cours. | dix-neuf-cent-nonante-neuf |
| T6-REV-030 | Écris l’année 2025 en lettres. | deux-mille-vingt-cinq |

Regionale alternatieven blijven accepted waar van toepassing.

---

# 30. Révision — mini-dialogen / teksten

### T6-REV-031 — Décrire une chambre
Je vous montre ma chambre.  
D’abord, il y a mon ___.  
Mon bureau se trouve ___ du lit.  
Sur le bureau, il y a mon ___.  
Ma chambre est bien ___.

Antwoorden:
`lit` · `en face` · `ordinateur` · `équipée`

### T6-REV-032 — Situer les objets
— Les assiettes sont où ?  
— Elles sont dans l’___.  
— Et les verres ?  
— Ils sont à ___ des assiettes.

Antwoorden:
`armoire` · `droite`

### T6-REV-033 — Passé composé avec être
Hier, Emma ___ à Bruxelles. (aller)  
Elle ___ à huit heures. (arriver)  
Le soir, elle ___ tard. (rentrer)

Antwoorden:
`est allée` · `est arrivée` · `est rentrée`

### T6-REV-034 — Accord
Lucas et Emma ___ en ville. (sortir)  
Emma et Sarah ___ à la maison. (rester)  
Lucas et Hugo ___ du train. (descendre)

Antwoorden:
`sont sortis` · `sont restées` · `sont descendus`

### T6-REV-035 — Questions
— ___ est-ce que tu habites ?  
— À Turnhout.  
— Tu vas à l’école ___ ?  
— À vélo.  
— Tu as ___ frères et sœurs ?  
— Deux.

Antwoorden:
`Où` · `comment` · `combien de`

### T6-REV-036 — Homophones
Lucas ___ treize ans. Il habite ___ Lille.  
Tu préfères le bus ___ le train ?  
Tu sais ___ est la gare ?  
___ gare est juste ___.  

Antwoorden:
`a` · `à` · `ou` · `où` · `La` · `là`

---

# 31. Révision — Bonne mémoire intégrée

Deze items herhalen doelbewust oudere leerstof omdat de cursus dit zelf aan het einde van Trajet 6 herneemt.

## 31.1 Articles
| ID | Vraag | Antwoord |
|---|---|---|
| T6-REV-OLD-001 | L’appartement est à qui ? — C’est l’appartement ___ parents de Mila. | des |
| T6-REV-OLD-002 | On va ___ premier étage ? | au |
| T6-REV-OLD-003 | Les toilettes sont ici ? — Non, elles sont en face ___ salle de bains. | de la |
| T6-REV-OLD-004 | Vous avez ___ jardin ? | un |

## 31.2 Possessifs
| ID | Vraag | Antwoord |
|---|---|---|
| T6-REV-OLD-005 | C’est ___ tiny house. (zijn) | sa |
| T6-REV-OLD-006 | Vous allez en France avec ___ caravane ? (jullie) | votre |
| T6-REV-OLD-007 | Ils ont quatorze ans. Ce sont des jumelles. ___ appartement est vraiment chouette. | Leur |
| T6-REV-OLD-008 | Ils ne sont pas Italiens. ___ parents sont Italiens. | Leurs |

## 31.3 Négation
| ID | Vraag | Antwoord |
|---|---|---|
| T6-REV-OLD-009 | Tu as une piscine ? — Non, ... | je n’ai pas de piscine |
| T6-REV-OLD-010 | Il travaille beaucoup ? — Non, ... | il ne travaille pas beaucoup |
| T6-REV-OLD-011 | Les enfants vont parfois au grenier ? — Non, ... | ils ne vont jamais au grenier |
| T6-REV-OLD-012 | Nous allons toujours au stade ? — Non, ... | nous n’allons jamais au stade |

Deze revisievarianten mappen naar de bestaande masterydoelen van eerdere Trajets, niet naar nieuwe T6-doelen.

---

# 32. UI-regels Trajet 6

## Vocabulaire
Twee hoofdvormen:
- **Traduire / Vertalen**
- **En contexte / In een zin**

Binnen context subtiele labels:
- Chambre
- Salle de bains
- Cuisine
- Objets / appareils

Geen aparte tegel per kamer.

## Actes de parole
Twee eenvoudige groepen:
- **Décrire une pièce / Een kamer beschrijven**
- **Situer un objet / Een voorwerp situeren**

## Verbes
Hoofdvormen:
- **Passé composé avec être**
- **Avoir ou être ? / Gemengd**

Binnen `être` kleine progressielagen:
- basis
- féminin
- pluriel
- accord gemengd

Geen 14 tegels voor de 14 werkwoorden.

## Nombres
Aparte tegel:
**De 0 à 100 000**

## Grammaire — Questions
Hoofdkeuzes:
- **Intonation**
- **Est-ce que**
- **Mots interrogatifs**
- **Mélange**

`que / quoi` als moeilijkheidslaag binnen vraagwoorden.

## Comment écrire ?
Aparte kleine tegel:
**a/à · ou/où · la/là**

Omdat dit schriftelijke spelling is, blijft deze module actief ondanks het technische `sound_rule`-itemtype.

---

# 33. Mapping- en implementatieregels voor Codex

1. Gebruik bestaande permanente item-ID’s uit `course.json`.
2. Verander de 157 bestaande T6-items niet qua ID.
3. Nieuwe variant-ID’s zijn oefenvarianten, geen course-items.
4. Kiosque en Trivial Pursuit niet als actieve oefenmodule tonen.
5. De zes `a/à`, `ou/où`, `la/là` records:
   - **niet verbergen**;
   - ondanks `sound_rule` behandelen als spelling/homofonen.
6. Vocab-contextvarianten mappen naar bestaande vocabulary-items.
7. Actes-varianten mappen naar bestaande phrase-items.
8. Passé composé avec être:
   - evidence naar de 18 bestaande T6 grammar_rule-items;
   - accord apart registreren waar de architectuur dit ondersteunt.
9. Bij `être` moet het participe passé overeenkomen met het onderwerp.
10. Gemengde groep met minstens één mannelijk lid → masculin pluriel.
11. Geen nieuwe permanente verb-items genereren voor de être-lijst.
12. `avoir/être`-gemengde vragen mogen evidence gebruiken uit T5 en T6 zonder masterydoelen te dupliceren.
13. Number range 0–100 000:
   - één bestaand number_spec-item;
   - geen 100 001 permanente number-items.
14. Belgische `septante/nonante` primair; regionale Franse vormen accepted.
15. Jaartalregels uit de cursus respecteren.
16. Questions:
   - geen inversie automatisch toevoegen als derde structuur;
   - focus op intonation en `est-ce que`, exact zoals de cursus.
17. `quoi` na het werkwoord; `que` vóór `est-ce que`.
18. Leestekens mappen naar de 11 bestaande vocabulary-items.
19. Multi-gap: elk gat apart beoordelen.
20. Volledige vertaalzinnen: geen blanket negative mastery bij één fout.
21. Randomisatie kiest alleen uit goedgekeurde statische banken plus gecontroleerde number-generator.
22. Geen automatische AI-zingeneratie.
23. Respecteer bestaande rounds/task/mastery-architectuur.

---

# 34. Kwaliteitscontrole — ronde 1: brongetrouwheid

Gecontroleerd:
- 157 permanente T6-items exact uit het bestaande bronpakket;
- Atelier Parole volgt `Décrire une pièce / Situer un objet`;
- 65 vocabitems + 42 phrase-items correct verwerkt;
- passé composé avec être volgt de 18 bestaande grammar targets;
- de 14 être-werkwoorden komen uit de cursus;
- accord-regel en gemengde groep expliciet verwerkt;
- numbers dynamisch 0–100 000;
- vragen beperken zich tot intonation + est-ce que + bronvraagwoorden;
- Comment écrire-items blijven actief als spelling;
- Kiosque en spelvorm uitgesloten.

---

# 35. Kwaliteitscontrole — ronde 2: ambiguïteit/didactiek

Gecontroleerd en aangepast:
- `toilette/toilettes` duidelijk onderscheiden;
- `baignoire/bain` duidelijk onderscheiden;
- `armoire/garde-robe/placard` niet als losse synoniemen behandeld;
- `bureau` hier als meubel gecontextualiseerd;
- `beau/joli/génial` niet als open contexttarget geforceerd;
- passé-composévragen gebruiken expliciete persoonsnamen voor agreement;
- geen `je suis arrivé(e)` als onafhankelijke open vraag zonder geslachtssignaal;
- questions hebben één bedoelde vraagstructuur;
- `que/quoi` apart gecontroleerd;
- homofonen hebben eenduidige syntactische context.

---

# 36. Kwaliteitscontrole — ronde 3: technische consistentie

Gecontroleerd:
- 157 permanente items blijven denominator/fundament;
- number_spec blijft één permanent item;
- zes spelling-items blijven bestaande IDs;
- geen nieuwe verb-items in T6;
- variant-ID’s uniek;
- multi-gap scoring per gat;
- integratieve vertaling geeft geen blanket negatieve mastery;
- herhaling van T1–T5 mapt terug naar bestaande oudere masterydoelen;
- numbervarianten vergroten denominator niet.

---

# 37. Gevonden data-/architectuuraandachtspunten

## 37.1 `sound_rule` is hier misleidend
De zes records voor:
- a
- à
- ou
- où
- la
- là

zijn onder `Comment écrire ?` zuivere spelling/homofonen.
Ze mogen niet verdwijnen doordat de app generiek alle `sound_rule`-items verbergt.

Aanbevolen:
- hide alleen echte uitspraak-/audiomodules;
- whitelist deze zes T6 spellingitems als actieve geschreven oefeninhoud.

## 37.2 `la toilette` versus `les toilettes`
Beide zijn aparte permanente vocabulary-items en hebben bewust een andere betekenis.
Niet samenvoegen als duplicate:
- `la toilette` → wc-pot
- `les toilettes` → toilet/toiletruimte

## 37.3 `bureau` heeft trajectafhankelijke context
In T5 is `le bureau` binnen woningbeschrijving een ruimte.
In T6 is `le bureau` in de kamerillustratie het meubel/bureau.
De permanente IDs blijven zoals ze zijn; contextoefeningen moeten duidelijk maken welke betekenis bedoeld wordt.

## 37.4 Questions: geen inversie uitbreiden
De cursus leert hier:
- intonation
- est-ce que

Codex mag niet zelfstandig moeilijkere inversievormen toevoegen (`Habites-tu ... ?`) als nieuwe T6-oefeningen.

---

# 38. Status Trajet 6

Inhoudelijk uitgewerkt:
- Vocabulaire kamer/meubels/toestellen
- Décrire une pièce
- Situer un objet
- Passé composé avec être
- Accord du participe passé
- Avoir ou être ? gemengd
- Nombres 0–100 000
- La question avec intonation
- La question avec est-ce que
- Mots interrogatifs
- Que / quoi
- Les signes
- a/à, ou/où, la/là
- Révision intégrative
- Bonne mémoire geïntegreerd als herhaling

Bewust niet als aparte digitale oefenbank:
- La chanson française / Kiosque
- Trivial Pursuit

Trajet 6 is klaar om als contentbron voor Codex gebruikt te worden.
