-- Alleen-lezen controles na handmatige fase-9-migratie.
select completion_strategy,count(*) as assignments
from public.assignments group by completion_strategy order by completion_strategy;

select t.tablename,c.relrowsecurity as rowsecurity,c.relforcerowsecurity as forcerowsecurity
from pg_catalog.pg_tables t
join pg_catalog.pg_class c on c.relname=t.tablename
join pg_catalog.pg_namespace n on n.oid=c.relnamespace and n.nspname=t.schemaname
where t.schemaname='public' and t.tablename in ('assignment_rounds','assignment_round_items');

select table_name,grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('assignment_rounds','assignment_round_items')
  and grantee in ('anon','authenticated','PUBLIC');

select count(*) as round_items_outside_assignment
from public.assignment_round_items ri
left join public.assignment_items ai on ai.assignment_id=ri.assignment_id and ai.item_id=ri.item_id
where ai.item_id is null;

select count(*) as completed_without_correct_practice_attempt
from public.assignment_round_items ri
where ri.completed_at is not null and not exists (
  select 1 from public.practice_sessions ps
  join public.practice_attempts pa on pa.session_id=ps.id
  where ps.assignment_id=ri.assignment_id and ps.student_id=ri.student_id
    and ps.assignment_round_number=ri.round_number and pa.mode='practice' and pa.was_correct
    and (pa.item_id=ri.item_id or ri.item_id=any(pa.equivalent_item_ids))
);
