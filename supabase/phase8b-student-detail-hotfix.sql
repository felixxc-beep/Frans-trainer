-- Fase 8b · handmatig uitvoeren NA phase8-class-monitor.sql.
-- Alleen de SQL-special forms LEAST/GREATEST in twee bestaande fase-7b
-- helpers herstellen. Signatures, beveiligingsattributen, grants en logica
-- blijven behouden. Geen datawijziging.
begin;

do $hotfix$
declare
  v_name text;
  v_function regprocedure;
  v_definition text;
  v_fixed text;
begin
  foreach v_name in array array[
    'private.verb_goal_progress(uuid,text,text)',
    'private.assignment_progress_for_student(uuid,uuid)'
  ] loop
    v_function := pg_catalog.to_regprocedure(v_name);
    if v_function is null then
      raise exception 'Vereiste fase-7b-functie ontbreekt: %', v_name;
    end if;
    v_definition := pg_catalog.pg_get_functiondef(v_function);
    v_fixed := pg_catalog.replace(
      pg_catalog.replace(v_definition, 'pg_catalog.least(', 'least('),
      'pg_catalog.greatest(', 'greatest(');
    if v_fixed <> v_definition then
      execute v_fixed;
    end if;
    v_definition := pg_catalog.pg_get_functiondef(v_function);
    if pg_catalog.strpos(v_definition, 'pg_catalog.least(') > 0
      or pg_catalog.strpos(v_definition, 'pg_catalog.greatest(') > 0 then
      raise exception 'SQL-special forms niet hersteld in %', v_name;
    end if;
  end loop;
end;
$hotfix$;

commit;
