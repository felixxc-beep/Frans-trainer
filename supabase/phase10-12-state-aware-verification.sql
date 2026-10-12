-- Read-only. Run AFTER phase10-12-state-aware-upgrade.sql in the Supabase SQL Editor.
-- New learner activity can increase counts; original rows were checked inside the migration transaction.
select private.mon_parcours_upgrade_verification() as verification;
