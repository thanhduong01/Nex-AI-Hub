-- Nex AI Hub: run manually in Supabase SQL Editor as the project administrator.
-- Run both files in supabase/migrations first. This script is NOT a migration.
-- Edit the four values below in SQL Editor only; never commit a real password.
-- Intended for a fresh Hub. Existing accounts/data are never overwritten.

do $bootstrap$
declare
  v_email text := 'YOUR_EMAIL@example.com';
  v_password text := $password$REPLACE_WITH_YOUR_OWN_PASSWORD$password$;
  v_display_name text := 'Duong';
  v_workspace_name text := 'Nex AI Hub';

  v_user_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_crypto_schema text;
  v_password_hash text;
begin
  v_email := lower(btrim(v_email));
  v_display_name := btrim(v_display_name);
  v_workspace_name := btrim(v_workspace_name);

  if v_email is null or v_email = 'your_email@example.com'
     or length(v_email) > 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Thay v_email bang dia chi email that cua ban.';
  end if;
  if v_password is null or v_password = 'REPLACE_WITH_YOUR_OWN_PASSWORD'
     or length(v_password) < 12 or octet_length(v_password) > 72 then
    raise exception 'Thay v_password: it nhat 12 ky tu, toi da 72 byte UTF-8 (gioi han bcrypt).';
  end if;
  if v_display_name is null or length(v_display_name) not between 1 and 100
     or v_workspace_name is null or length(v_workspace_name) not between 1 and 100 then
    raise exception 'Ten Owner va workspace phai dai tu 1 den 100 ky tu.';
  end if;
  if to_regclass('public.members') is null or to_regclass('public.workspaces') is null then
    raise exception 'Chay migrations Nex AI Hub truoc khi tao Owner.';
  end if;

  -- Serialize fresh-Hub provisioning; refuse to change any existing workspace.
  perform set_config('lock_timeout', '5s', true);
  lock table public.workspaces, public.members in share row exclusive mode;
  if exists (select 1 from public.members where role = 'owner') then
    raise exception 'Hub da co Owner. Script khong doi mat khau hoac tao Owner thu hai.';
  end if;
  if exists (select 1 from public.members) or exists (select 1 from public.workspaces) then
    raise exception 'Hub da co du lieu. Can kiem tra workspace/thanh vien truoc khi cap Owner.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Email da ton tai trong Authentication. Script khong ghi de tai khoan nay.';
  end if;

  create schema if not exists extensions;
  create extension if not exists pgcrypto with schema extensions;
  select n.nspname into strict v_crypto_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto';
  -- Honor the installed extension schema and parameterize the password.
  execute format('select %I.crypt($1, %I.gen_salt(''bf'', 10))',
    v_crypto_schema, v_crypto_schema)
    into v_password_hash using v_password;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_super_admin, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, email_change_confirm_status,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id,
    'authenticated', 'authenticated', v_email, v_password_hash,
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', v_display_name),
    now(), now(), false, false, false,
    '', '', '', '', '', 0, '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at
  ) values (
    gen_random_uuid(), v_user_id, v_user_id::text, 'email',
    jsonb_build_object('sub', v_user_id::text, 'email', v_email,
      'email_verified', true, 'phone_verified', false), now(), now()
  );

  insert into public.workspaces (id, name, monthly_budget)
    values (v_workspace_id, v_workspace_name, 0);
  insert into public.members (
    user_id, workspace_id, email, display_name, role, status, monthly_limit
  ) values (
    v_user_id, v_workspace_id, v_email, v_display_name, 'owner', 'active', 0
  );
  insert into public.audit_events (workspace_id, actor_id, action, resource_id)
    values (v_workspace_id, v_user_id, 'owner.bootstrap.sql', v_user_id::text);
end
$bootstrap$;

-- Return login email and membership only; never return the password or hash.
select m.email, m.display_name, m.role, m.status, w.name as workspace,
       w.monthly_budget
from public.members m
join public.workspaces w on w.id = m.workspace_id
where m.role = 'owner';
