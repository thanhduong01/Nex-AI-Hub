import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

// Execute the manual SQL unchanged except its documented input placeholders.
// Auth tables are fixtures, not a hosted Supabase Auth service. pgcrypto is real.
let db: PGlite;
let source: string;
const email = 'owner@fixture.invalid';
const password = "Fixture's#Password2026";
const script = (mail = email, pass = password) =>
  source.replace('YOUR_EMAIL@example.com', mail).replace('REPLACE_WITH_YOUR_OWN_PASSWORD', pass);

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  source = await readFile(new URL('../supabase/bootstrap-owner.sql', import.meta.url), 'utf8');
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users (
      id uuid primary key, instance_id uuid, aud text, role text,
      email text unique, encrypted_password text, email_confirmed_at timestamptz,
      raw_app_meta_data jsonb, raw_user_meta_data jsonb,
      created_at timestamptz, updated_at timestamptz,
      is_super_admin boolean, is_sso_user boolean, is_anonymous boolean,
      confirmation_token text, recovery_token text, email_change_token_new text,
      email_change_token_current text, email_change text, email_change_confirm_status integer,
      phone_change text, phone_change_token text, reauthentication_token text,
      confirmed_at timestamptz generated always as (email_confirmed_at) stored
    );
    create table auth.identities (
      id uuid primary key, user_id uuid not null references auth.users(id),
      provider_id text not null, provider text not null, identity_data jsonb not null,
      created_at timestamptz, updated_at timestamptz,
      email text generated always as (lower(identity_data->>'email')) stored,
      unique(provider_id, provider)
    );
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(auth.jwt()->>'sub','')::uuid
    $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
  `);
  await db.exec(
    await readFile(new URL('../supabase/migrations/202611030001_hub.sql', import.meta.url), 'utf8'),
  );
});
beforeEach(async () => {
  await db.exec('begin');
});
afterEach(async () => {
  await db.exec('rollback');
});
afterAll(async () => {
  await db.close();
});

async function rejected(sql: string, message: RegExp) {
  await db.exec('savepoint reject_bootstrap');
  await expect(db.exec(sql)).rejects.toThrow(message);
  await db.exec('rollback to savepoint reject_bootstrap');
}

it('creates a confirmed bcrypt user, email identity and active Owner that can open Hub', async () => {
  await db.exec(script('  OWNER@fixture.invalid  '));
  const { rows } = await db.query<{
    user_id: string;
    workspace_id: string;
    matches: boolean;
    role: string;
    status: string;
    auth_role: string;
    email: string;
    confirmed: boolean;
    correct_identity: boolean;
    zero_budget: boolean;
  }>(
    `select m.user_id, m.workspace_id, m.role, m.status, m.email,
      u.role as auth_role, u.email_confirmed_at is not null as confirmed,
      u.encrypted_password = extensions.crypt($1,u.encrypted_password) as matches,
      i.provider_id = u.id::text and i.provider='email'
        and i.identity_data->>'sub'=u.id::text and i.email=u.email
        and (i.identity_data->>'email_verified')::boolean as correct_identity,
      w.monthly_budget=0 and m.monthly_limit=0 as zero_budget
     from public.members m join auth.users u on u.id=m.user_id
     join auth.identities i on i.user_id=u.id
     join public.workspaces w on w.id=m.workspace_id`,
    [password],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    role: 'owner',
    status: 'active',
    auth_role: 'authenticated',
    email,
    confirmed: true,
    matches: true,
    correct_identity: true,
    zero_budget: true,
  });
  const owner = rows[0]!;
  const session = randomUUID();
  await db.query('select public.register_hub_session($1,$2)', [owner.user_id, session]);
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: owner.user_id, session_id: session, role: 'authenticated' }),
  ]);
  await db.exec('set local role authenticated');
  expect((await db.query('select * from public.workspaces')).rows).toHaveLength(1);
  expect(
    (
      await db.query<{ allowed: boolean }>('select private.is_owner($1) as allowed', [
        owner.workspace_id,
      ])
    ).rows[0]?.allowed,
  ).toBe(true);
});

it('refuses reruns without changing the existing password, identity or workspace', async () => {
  await db.exec(script());
  await rejected(script(email, 'Replacement#Password2026'), /Hub da co Owner/);
  expect((await db.query('select * from public.workspaces')).rows).toHaveLength(1);
  expect((await db.query('select * from auth.identities')).rows).toHaveLength(1);
  const hash = await db.query<{ matches: boolean }>(
    'select encrypted_password=extensions.crypt($1,encrypted_password) as matches from auth.users',
    [password],
  );
  expect(hash.rows[0]?.matches).toBe(true);
});

it('refuses to take over an existing Auth account', async () => {
  await db.query('insert into auth.users(id,email) values($1,$2)', [randomUUID(), email]);
  await rejected(script(), /Email da ton tai/);
  expect((await db.query('select * from public.members')).rows).toHaveLength(0);
  expect((await db.query('select * from public.workspaces')).rows).toHaveLength(0);
});

it('refuses to provision into a nonempty Hub', async () => {
  await db.exec("insert into public.workspaces(name) values('Existing workspace')");
  await rejected(script(), /Hub da co du lieu/);
  expect((await db.query('select * from auth.users')).rows).toHaveLength(0);
});

it.each([
  ['YOUR_EMAIL@example.com', password, /Thay v_email/],
  [email, 'REPLACE_WITH_YOUR_OWN_PASSWORD', /Thay v_password/],
  [email, 'short', /Thay v_password/],
  [email, 'á'.repeat(37), /Thay v_password/],
])('rejects invalid bootstrap inputs (%s)', async (mail, pass, message) => {
  await rejected(script(mail, pass), message);
  expect((await db.query('select * from auth.users')).rows).toHaveLength(0);
});

it('rolls back Auth and workspace records when the final membership insert fails', async () => {
  await db.exec(`
    create function public.reject_owner_fixture() returns trigger language plpgsql as $$
      begin raise exception 'fixture membership failure'; end
    $$;
    create trigger reject_owner_fixture before insert on public.members
      for each row execute function public.reject_owner_fixture();
  `);
  // Catch inside a PL/pgSQL subtransaction so any earlier partial writes would
  // remain visible unless the bootstrap DO statement itself is atomic.
  const statement = script().slice(0, script().indexOf('-- Return login'));
  await db.exec(`do $test$ begin
    begin execute $script$${statement}$script$;
    exception when raise_exception then
      if sqlerrm <> 'fixture membership failure' then raise; end if;
    end;
  end $test$;`);
  for (const table of [
    'auth.users',
    'auth.identities',
    'public.workspaces',
    'public.members',
    'public.audit_events',
  ])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
});
