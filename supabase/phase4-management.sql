-- Mon parcours · fase 4 · handmatig uitvoeren in Supabase SQL Editor
-- Deze migratie wijzigt alleen de klascode-validatie van 3–32 naar 2–20 tekens
-- en sluit underscores uit. Grants, RLS, leerling-sync en resultaten blijven ongewijzigd.

begin;

do $$
begin
  if exists (
    select 1
    from public.classes
    where class_code !~ '^[A-Za-z0-9-]{2,20}$'
  ) then
    raise exception 'Bestaande klascode voldoet niet aan de fase-4-regel (2–20 letters/cijfers/streepje). Pas die code eerst aan.';
  end if;
end;
$$;

alter table public.classes
  drop constraint if exists classes_class_code_check;

alter table public.classes
  add constraint classes_class_code_check
  check (class_code ~ '^[A-Za-z0-9-]{2,20}$');

commit;
