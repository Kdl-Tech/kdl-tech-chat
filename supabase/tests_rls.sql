-- Tests RLS — Tchat privé KDL-TECH (Palier 3B)
-- ✅ Exécutés avec succès le 2026-06-12 (17/17) via Management API sur kdl-tech-chat.
-- Rejouables dans le SQL Editor Supabase. Remplacer <UUID_TEST> par l'uuid d'un user
-- de test (Authentication → Users → Add user, "Auto confirm"). Aucun secret ici.
--
-- ⚠ Piège appris au 3B : toujours utiliser `begin; set local role …; … rollback;`
-- (jamais `set role` nu) — les connexions étant poolées, un `set` de niveau session
-- pollue les requêtes suivantes et rend les résultats aléatoires.

-- ===== Anonyme : tout est refusé =====
begin;
set local role anon;
select count(*) as messages_visibles_anon from public.messages;  -- attendu : 0
select count(*) as profils_visibles_anon  from public.profiles;  -- attendu : 0
rollback;

begin;
set local role anon;
insert into public.messages (user_id, content)
values ('00000000-0000-0000-0000-000000000000', 'doit échouer');  -- attendu : RLS error
rollback;

begin;
set local role anon;
select public.soft_delete_message(1);  -- attendu : permission denied (execute révoqué)
rollback;

-- ===== Connecté : en son nom propre uniquement =====
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID_TEST>","role":"authenticated"}', true);
insert into public.messages (user_id, content) values ('<UUID_TEST>', 'test rls');
select count(*) as visibles_connecte from public.messages;  -- attendu : >= 1
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID_TEST>","role":"authenticated"}', true);
insert into public.messages (user_id, content)
values ('11111111-1111-1111-1111-111111111111', 'doit échouer');  -- attendu : RLS error
rollback;

-- UPDATE direct neutralisé : aucune policy UPDATE → 0 ligne touchée, jamais d'édition
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID_TEST>","role":"authenticated"}', true);
with u as (update public.messages set content = 'hack' returning id)
select count(*) as lignes_modifiees from u;  -- attendu : 0
rollback;

-- ===== Soft-delete via RPC =====
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID_TEST>","role":"authenticated"}', true);
insert into public.messages (user_id, content) values ('<UUID_TEST>', 'à supprimer');
select public.soft_delete_message(id) as ok from public.messages
  where user_id = '<UUID_TEST>' and deleted_at is null
  order by id desc limit 1;                                       -- attendu : true
select count(*) as visibles_apres_delete from public.messages
  where user_id = '<UUID_TEST>';                                  -- attendu : 0 (invisible)
select public.restore_message(1);  -- attendu : exception "restauration réservée au staff"
rollback;

-- ===== Banni : tout est bloqué =====
update public.profiles set banned_until = now() + interval '1 day' where id = '<UUID_TEST>';

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID_TEST>","role":"authenticated"}', true);
select count(*) as visibles_banni from public.messages;            -- attendu : 0
insert into public.messages (user_id, content)
values ('<UUID_TEST>', 'doit échouer');                             -- attendu : RLS error
rollback;

update public.profiles set banned_until = null where id = '<UUID_TEST>';

-- ===== Staff : voit les supprimés, restaure, modère =====
update public.profiles set role = 'moderator' where id = '<UUID_TEST>';

begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UUID_TEST>","role":"authenticated"}', true);
select count(*) as supprimes_visibles_staff from public.messages where deleted_at is not null;
select public.restore_message(id) from public.messages where deleted_at is not null limit 1;  -- true
rollback;

update public.profiles set role = 'member' where id = '<UUID_TEST>';

-- ===== Vérifs structurelles =====
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('profiles', 'messages');
-- attendu : rowsecurity = true sur les 2 lignes

select policyname, cmd from pg_policies
where schemaname = 'public' order by policyname;
-- attendu : 5 policies (3 profiles, 2 messages — AUCUNE policy UPDATE/DELETE sur messages)

select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime';
-- attendu : public.messages présent
