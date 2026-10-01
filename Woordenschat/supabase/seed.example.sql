-- OPTIONEEL TESTVOORBEELD. Vervang eerst de UUID hieronder door de id van je leerkracht
-- uit Authentication > Users. Voer dit bestand niet ongewijzigd uit.

do $$
declare
  teacher_id uuid := '00000000-0000-0000-0000-000000000000';
  new_class_id uuid;
begin
  if teacher_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Vervang teacher_id eerst door de echte Auth-gebruikers-ID';
  end if;

  insert into public.classes (owner_id, name, class_code)
  values (teacher_id, 'Klas 1A', 'KLAS1A')
  returning id into new_class_id;

  insert into public.students (class_id, student_code, display_name) values
    (new_class_id, 'K7M9-P4Q2', 'Leerling 01'),
    (new_class_id, 'R8V3-X6N5', 'Leerling 02');
end;
$$;
