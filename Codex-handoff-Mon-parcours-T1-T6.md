# Codex handoff — Mon parcours Trajets 1–6

Gebruik `Mon-parcours-master-content-spec-T1-T6.md` als **inhoudelijke bron van waarheid**.

## Opdracht
Implementeer de oefenbanken en oefenvormen van Trajet 1 t.e.m. 6 in de bestaande Mon parcours-codebase, zonder de bestaande 1036 permanente course-items of hun item-ID's te wijzigen.

## Eerst doen
1. Lees de volledige master spec.
2. Inspecteer de huidige data-architectuur, masterylogica, rounds/tasks, offline queue en bestaande UI.
3. Maak een kort implementatieplan op basis van de bestaande code. Pas daarna code aan.

## Niet doen
- Geen nieuwe didactische zinnen genereren.
- Geen nieuwe permanente mastery-items maken.
- Geen bestaande course-item-ID's wijzigen.
- Geen bestaande completion/masterydata migreren naar andere IDs.
- Geen fuzzy/AI-answer grading toevoegen.
- Geen inversievormen of andere grammatica toevoegen die niet in de spec staan.
- Geen audio-only modules zichtbaar maken zonder audio.

## Verplicht
- Exercise variants blijven varianten en mappen naar bestaande doelen.
- Multi-gap registreert per gat.
- Volledige integratieve vertaling: een fout mag niet alle gekoppelde masterydoelen negatief bestraffen.
- Number ranges blijven dynamisch en vergroten de mastery denominator niet.
- T6 `a/à`, `ou/où`, `la/là` blijven actief als spelling, ondanks hun technische `sound_rule`-type.
- Respecteer alle expliciete `do not use` / `definitieve vervanging`-notities in de master spec.
- Behoud backward compatibility met bestaande assignments, rounds en mastery.

## Implementatieaanpak
Werk in kleine controleerbare fases:
1. variantdatamodel + statische contentdata;
2. generieke exercise renderers;
3. mapping/evidence;
4. Trajet 1;
5. Trajet 2;
6. Trajet 3;
7. Trajet 4;
8. Trajet 5;
9. Trajet 6;
10. globale Révision en UI-consistentie;
11. tests/validatie.

Na elke fase:
- run tests;
- controleer unieke variant-ID's;
- controleer dat permanente IDs niet veranderden;
- rapporteer kort wat gewijzigd is en wat nog niet.

Begin niet door het hele systeem te herschrijven. Bouw voort op de bestaande architectuur.
