-- Tchat privé KDL-TECH — schéma + RLS Supabase
-- À exécuter dans l'éditeur SQL du projet Supabase (jamais depuis le frontend).

-- ---------- profils (miroir public de auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  avatar_url text,
  role text not null default 'member' check (role in ('member','moderator','admin')),
  banned_until timestamptz,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'user_name', 'membre_' || left(new.id::text, 8)));
  return new;
exception when unique_violation then
  -- pseudo OAuth déjà pris : fallback sur un nom dérivé de l'uuid (sinon l'inscription entière échoue)
  insert into public.profiles (id, username)
  values (new.id, 'membre_' || left(new.id::text, 8));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- messages
create table public.messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);
create index messages_created_at_idx on public.messages (created_at desc);

-- ---------- helpers rôle/ban
create function public.is_staff(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role in ('moderator','admin'));
$$;

create function public.is_banned(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and banned_until > now());
$$;

-- ---------- RLS : rien sans connexion
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

-- profils : lisibles par tout utilisateur CONNECTÉ ; modifiable par soi (sauf role/ban) ou staff
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'member' and banned_until is null);
create policy "profiles_update_staff" on public.profiles
  for update to authenticated using (public.is_staff(auth.uid()));

-- messages : lecture connectés NON bannis uniquement, messages non supprimés (staff voit tout)
create policy "messages_select_authenticated" on public.messages
  for select to authenticated
  using (not public.is_banned(auth.uid())
         and (deleted_at is null or public.is_staff(auth.uid())));

-- écriture : connecté, non banni, en son nom propre
create policy "messages_insert_member" on public.messages
  for insert to authenticated
  with check (user_id = auth.uid() and not public.is_banned(auth.uid()));

-- suppression douce : via fonctions SECURITY DEFINER uniquement — AUCUNE policy UPDATE,
-- donc aucun UPDATE direct possible côté client (un message posté est immuable).
-- Pourquoi pas une policy UPDATE ? PostgreSQL exige que la ligne MODIFIÉE reste visible
-- par la policy SELECT de celui qui fait l'UPDATE ; or un message soft-deleted devient
-- invisible pour son auteur (seul le staff voit les supprimés) → l'UPDATE de l'auteur
-- échouait toujours (42501). Découvert aux tests RLS réels du Palier 3B.
-- Côté frontend : supabase.rpc('soft_delete_message', { msg_id }).
create function public.soft_delete_message(msg_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_banned(auth.uid()) then
    raise exception 'messages : non autorisé';
  end if;
  update public.messages
     set deleted_at = now(), deleted_by = auth.uid()
   where id = msg_id and deleted_at is null
     and (user_id = auth.uid() or public.is_staff(auth.uid()));
  return found;  -- false = message inexistant, déjà supprimé ou pas le sien
end $$;

create function public.restore_message(msg_id bigint) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then
    raise exception 'messages : restauration réservée au staff';
  end if;
  update public.messages set deleted_at = null, deleted_by = null
   where id = msg_id and deleted_at is not null;
  return found;
end $$;

revoke execute on function public.soft_delete_message(bigint), public.restore_message(bigint) from public, anon;
grant execute on function public.soft_delete_message(bigint), public.restore_message(bigint) to authenticated;

-- garde-fou (défense en profondeur, y compris pour les fonctions ci-dessus et le SQL admin) :
-- rend le message immuable (seul le soft-delete passe) et réserve la restauration au staff.
create function public.guard_message_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.content is distinct from old.content
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'messages : contenu immuable, seul le soft-delete est autorisé';
  end if;
  -- restauration (deleted_at → null) : staff uniquement (auth.uid() null = SQL direct/admin, autorisé)
  if old.deleted_at is not null and new.deleted_at is null
     and auth.uid() is not null and not public.is_staff(auth.uid()) then
    raise exception 'messages : restauration réservée au staff';
  end if;
  return new;
end $$;

create trigger messages_guard_update
  before update on public.messages for each row execute function public.guard_message_update();

-- aucun DELETE physique côté client (aucune policy delete) ; service_role reste côté admin/SQL.

-- ---------- Realtime
alter publication supabase_realtime add table public.messages;
