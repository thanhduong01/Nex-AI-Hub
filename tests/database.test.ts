import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// PostgreSQL integration tests: fixtures are synthetic and the migration executes
// unchanged. Only hosted Supabase's identity schema/roles are substituted.
const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const W = id(1),
  W2 = id(2),
  OWNER = id(11),
  ALICE = id(12),
  BOB = id(13),
  OUTSIDER = id(14);
const S_OWNER = id(21),
  S_ALICE = id(22),
  S_BOB = id(23),
  S_OUTSIDER = id(24);
const P_OWNER = id(31),
  P_ALICE = id(32),
  P_BOB = id(33),
  P_FOREIGN = id(34);
const C = id(41),
  C_FOREIGN = id(42),
  Q_OWNER = id(51),
  Q_ALICE = id(52),
  Q_BOB = id(53),
  Q_FOREIGN = id(54);
const M_OWNER = id(61),
  M_ALICE = id(62),
  M_BOB = id(63),
  M_FOREIGN = id(64);
let db: PGlite;
type RunResult = {
  is_new: boolean;
  run: { id: string; reserved_cost: number; status: string; max_output_tokens: number };
};

async function query<T>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}
async function admin() {
  await db.exec('reset role');
  await query("select set_config('request.jwt.claims','{}',true)");
}
async function actor(user = ALICE, session = S_ALICE) {
  await db.exec('reset role');
  await query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify({ sub: user, session_id: session, role: 'authenticated' }),
  ]);
  await db.exec('set local role authenticated');
}
async function denied(sql: string, params: unknown[], message: RegExp) {
  await db.exec('savepoint expected_error');
  let failure: unknown;
  try {
    await db.query(sql, params);
  } catch (error) {
    failure = error;
  }
  await db.exec('rollback to savepoint expected_error');
  expect(failure).toBeInstanceOf(Error);
  expect(String(failure)).toMatch(message);
}
async function begin(
  conversation = Q_ALICE,
  request = randomUUID(),
  user = ALICE,
  session = S_ALICE,
  last: string | null = M_ALICE,
) {
  const rows = await query<{ result: RunResult }>(
    'select public.begin_run($1,$2,$3,$4,$5,$6,$7) as result',
    [user, session, conversation, request, 'A genuine new question', 1000, last],
  );
  return rows[0]!.result;
}
async function finish(
  run: string,
  status = 'completed',
  input: number | null = 100,
  output: number | null = 20,
) {
  await query('select public.finish_run($1,$2,$3,$4,$5,$6)', [
    run,
    status,
    'Answer retained in database',
    input,
    output,
    status === 'completed' ? null : 'PROVIDER_INTERRUPTED',
  ]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
  `);
  await db.exec(
    await readFile(new URL('../supabase/migrations/202611030001_hub.sql', import.meta.url), 'utf8'),
  );
  await query('insert into auth.users(id) select unnest($1::uuid[])', [
    [OWNER, ALICE, BOB, OUTSIDER],
  ]);
  await query(
    'insert into public.workspaces(id,name,monthly_budget) values($1,$2,100),($3,$4,100)',
    [W, 'Fixture workspace', W2, 'Other company'],
  );
  for (const [user, w, name, role] of [
    [OWNER, W, 'Owner', 'owner'],
    [ALICE, W, 'Alice', 'employee'],
    [BOB, W, 'Bob', 'employee'],
    [OUTSIDER, W2, 'Other owner', 'owner'],
  ]) {
    await query(
      'insert into public.members(user_id,workspace_id,email,display_name,role,monthly_limit) values($1,$2,$3,$4,$5,50)',
      [user, w, `${user}@example.invalid`, name, role],
    );
  }
  for (const [user, session] of [
    [OWNER, S_OWNER],
    [ALICE, S_ALICE],
    [BOB, S_BOB],
    [OUTSIDER, S_OUTSIDER],
  ])
    await query('select public.register_hub_session($1,$2)', [user, session]);
  for (const [project, user, w, name] of [
    [P_OWNER, OWNER, W, 'Owner work'],
    [P_ALICE, ALICE, W, 'Alice work'],
    [P_BOB, BOB, W, 'Bob work'],
    [P_FOREIGN, OUTSIDER, W2, 'Foreign work'],
  ]) {
    await query(
      'insert into public.projects(id,workspace_id,created_by,name) values($1,$2,$3,$4)',
      [project, w, user, name],
    );
  }
  await query(
    "insert into public.project_members(project_id,user_id,permission) values($1,$2,'viewer')",
    [P_ALICE, BOB],
  );
  for (const [connection, w] of [
    [C, W],
    [C_FOREIGN, W2],
  ]) {
    await query(
      "insert into public.connections(id,workspace_id,provider,name,model,enabled,input_price,output_price,max_output_tokens) values($1,$2,'openai','Fixture AI','fixture-text',true,1,2,1000)",
      [connection, w],
    );
    await query('insert into private.connection_secrets(connection_id,ciphertext) values($1,$2)', [
      connection,
      'synthetic encrypted fixture',
    ]);
  }
  await query('insert into public.connection_grants(connection_id,user_id) values($1,$2),($1,$3)', [
    C,
    ALICE,
    BOB,
  ]);
  for (const [conversation, project, user, connection, message, keyword] of [
    [Q_OWNER, P_OWNER, OWNER, C, M_OWNER, 'ownerkeyword'],
    [Q_ALICE, P_ALICE, ALICE, C, M_ALICE, 'alicekeyword'],
    [Q_BOB, P_BOB, BOB, C, M_BOB, 'bobsecretkeyword'],
    [Q_FOREIGN, P_FOREIGN, OUTSIDER, C_FOREIGN, M_FOREIGN, 'foreignsecretkeyword'],
  ]) {
    await query(
      'insert into public.conversations(id,project_id,created_by,title,connection_id,model) values($1,$2,$3,$4,$5,$6)',
      [conversation, project, user, `${keyword} conversation`, connection, 'fixture-text'],
    );
    await query(
      "insert into public.messages(id,conversation_id,role,content,author_id) values($1,$2,'user',$3,$4)",
      [message, conversation, `${keyword} private message`, user],
    );
    await query(
      "insert into public.documents(project_id,uploaded_by,name,storage_path,mime_type,size_bytes,text_content) values($1,$2,$3,$4,'text/plain',40,$5)",
      [project, user, `${keyword}.txt`, `${project}/file.txt`, keyword],
    );
  }
});
beforeEach(async () => {
  await db.exec('begin');
});
afterEach(async () => {
  await db.exec('rollback');
});
afterAll(async () => {
  await db?.close();
});

describe('Database authorization and seven-day sessions', () => {
  it('denies anonymous table and RPC access and permits only the intended service role operations', async () => {
    await db.exec('set local role anon');
    await denied('select id from projects', [], /permission denied/);
    await denied('select * from search_conversations($1)', ['alicekeyword'], /permission denied/);
    await db.exec('reset role; set local role service_role');
    expect(
      (await query<{ secret: string }>('select get_connection_secret($1) as secret', [C]))[0]!
        .secret,
    ).toBe('synthetic encrypted fixture');
    const r = await begin();
    expect(r.is_new).toBe(true);
    await finish(r.run.id);
    expect(
      (await query<{ status: string }>('select status from runs where id=$1', [r.run.id]))[0]!
        .status,
    ).toBe('completed');
  });

  it('owner reads every local project but cannot edit, share or chat in another owner’s project', async () => {
    await actor(OWNER, S_OWNER);
    expect(
      (await query<{ id: string }>('select id from projects order by id')).map((p) => p.id),
    ).toEqual([P_OWNER, P_ALICE, P_BOB]);
    expect(
      await query('update projects set name=$1 where id=$2 returning id', ['Not allowed', P_ALICE]),
    ).toEqual([]);
    await denied(
      "insert into project_members(project_id,user_id,permission) values($1,$2,'contributor')",
      [P_BOB, ALICE],
      /row-level security/,
    );
    await denied(
      'select create_conversation($1,$2,$3)',
      [P_ALICE, 'Owner cannot contribute implicitly', C],
      /FORBIDDEN/,
    );
    expect(await query('select * from messages where conversation_id=$1', [Q_FOREIGN])).toEqual([]);
  });

  it('employee cannot enumerate unshared projects, messages, documents or search snippets', async () => {
    await actor();
    expect((await query<{ id: string }>('select id from projects')).map((p) => p.id)).toEqual([
      P_ALICE,
    ]);
    expect((await query<{ id: string }>('select id from conversations')).map((p) => p.id)).toEqual([
      Q_ALICE,
    ]);
    expect((await query<{ id: string }>('select id from messages')).map((p) => p.id)).toEqual([
      M_ALICE,
    ]);
    expect(
      (await query<{ project_id: string }>('select project_id from documents')).map(
        (p) => p.project_id,
      ),
    ).toEqual([P_ALICE]);
    expect(await query('select * from search_conversations($1)', ['bobsecretkeyword'])).toEqual([]);
    expect(await query('select * from search_conversations($1)', ['foreignsecretkeyword'])).toEqual(
      [],
    );
    expect((await query('select * from search_conversations($1)', ['alicekeyword'])).length).toBe(
      1,
    );
    await denied(
      'select record_access($1,$2,$3)',
      [P_BOB, 'conversation.export', Q_BOB],
      /FORBIDDEN/,
    );
  });

  it('read-only sharing grants reads but does not grant chat or further sharing', async () => {
    await actor(BOB, S_BOB);
    expect(
      (await query<{ id: string }>('select id from projects order by id')).map((p) => p.id),
    ).toEqual([P_ALICE, P_BOB]);
    expect(await query('select id from messages where conversation_id=$1', [Q_ALICE])).toHaveLength(
      1,
    );
    await denied(
      'select create_conversation($1,$2,$3)',
      [P_ALICE, 'Read-only cannot write', C],
      /FORBIDDEN/,
    );
    await denied(
      "insert into project_members(project_id,user_id,permission) values($1,$2,'viewer')",
      [P_ALICE, OWNER],
      /row-level security/,
    );
  });

  it('revoking sharing removes read access on the next query', async () => {
    await actor(BOB, S_BOB);
    expect(await query('select id from messages where conversation_id=$1', [Q_ALICE])).toHaveLength(
      1,
    );
    await actor();
    await query('delete from project_members where project_id=$1 and user_id=$2', [P_ALICE, BOB]);
    await actor(BOB, S_BOB);
    expect(await query('select id from messages where conversation_id=$1', [Q_ALICE])).toEqual([]);
  });

  it('prevents cross-workspace sharing, project creation and immutable ownership changes', async () => {
    await actor();
    await denied(
      "insert into project_members(project_id,user_id,permission) values($1,$2,'viewer')",
      [P_ALICE, OUTSIDER],
      /row-level security/,
    );
    await denied(
      'insert into projects(workspace_id,created_by,name) values($1,$2,$3)',
      [W2, ALICE, 'Cross tenant'],
      /row-level security|foreign key/,
    );
    await denied(
      'update projects set created_by=$1 where id=$2',
      [OWNER, P_ALICE],
      /permission denied/,
    );
    await denied("update members set role='owner' where user_id=$1", [ALICE], /permission denied/);
  });

  it('requires a registered session matching the JWT user, not just a valid user ID', async () => {
    await actor(ALICE, randomUUID());
    expect(await query('select id from projects')).toEqual([]);
    await actor(ALICE, S_OWNER);
    expect(await query('select id from projects')).toEqual([]);
    await denied('select register_hub_session($1,$2)', [ALICE, randomUUID()], /permission denied/);
  });

  it('registers an absolute seven-day lifetime and never extends it on re-registration', async () => {
    const session = randomUUID();
    await query('select register_hub_session($1,$2)', [ALICE, session]);
    const first = (
      await query<{ seconds: string; expires_at: Date }>(
        'select extract(epoch from(expires_at-created_at)) as seconds,expires_at from private.hub_sessions where session_id=$1',
        [session],
      )
    )[0]!;
    expect(Number(first.seconds)).toBe(604800);
    await query(
      "update private.hub_sessions set expires_at=now()+interval '5 days' where session_id=$1",
      [session],
    );
    const before = (
      await query<{ expires_at: Date }>(
        'select expires_at from private.hub_sessions where session_id=$1',
        [session],
      )
    )[0]!.expires_at;
    await query('select register_hub_session($1,$2)', [ALICE, session]);
    const after = (
      await query<{ expires_at: Date }>(
        'select expires_at from private.hub_sessions where session_id=$1',
        [session],
      )
    )[0]!.expires_at;
    expect(after).toEqual(before);
    await query('update private.hub_sessions set expires_at=now() where session_id=$1', [session]);
    await actor(ALICE, session);
    expect(await query('select id from projects')).toEqual([]);
    expect((await query<{ info: unknown }>('select session_info() as info'))[0]!.info).toBeNull();
  });

  it('logout and suspension immediately invalidate Hub RLS and stop active runs', async () => {
    const run = await begin();
    await query('select update_employee($1,$2,$3,$4,$5)', [OWNER, S_OWNER, ALICE, 'suspended', 50]);
    expect(
      (
        await query<{ allowed: boolean }>('select run_can_continue($1) as allowed', [run.run.id])
      )[0]!.allowed,
    ).toBe(false);
    await actor();
    expect(await query('select id from projects')).toEqual([]);
    await actor(BOB, S_BOB);
    await query('select revoke_session()');
    expect(await query('select id from projects')).toEqual([]);
    await admin();
    await query('select update_employee($1,$2,$3,$4,$5)', [OWNER, S_OWNER, ALICE, 'active', 50]);
    await actor();
    expect(await query('select id from projects')).toEqual([]); // unlocking does not restore revoked sessions
  });

  it('password recovery revokes every Hub session for that user while preserving other users’ sessions', async () => {
    const second = randomUUID();
    await query('select register_hub_session($1,$2)', [ALICE, second]);
    const r = await begin();
    await actor(ALICE, second);
    await query('select revoke_all_sessions()');
    expect(await query('select id from projects')).toEqual([]);
    await actor(ALICE, S_ALICE);
    expect(await query('select id from projects')).toEqual([]);
    await actor(BOB, S_BOB);
    expect(await query('select id from projects')).toHaveLength(2);
    await admin();
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(false);
  });

  it('keeps secrets, privileged RPCs and admin account records inaccessible to employees', async () => {
    await actor();
    expect((await query<{ id: string }>('select id from connections')).map((c) => c.id)).toEqual([
      C,
    ]);
    expect(await query('select * from connection_grants')).toHaveLength(1); // no recursive RLS
    expect(await query('select * from provider_accounts')).toEqual([]);
    expect(await query('select * from audit_events')).toEqual([]);
    await denied('select ciphertext from private.connection_secrets', [], /permission denied/);
    await denied('select get_connection_secret($1)', [C], /permission denied/);
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [ALICE, S_ALICE, Q_ALICE, randomUUID(), 'Bypass', 1, M_ALICE],
      /permission denied/,
    );
    await actor(OWNER, S_OWNER);
    expect(await query('select * from connection_grants')).toHaveLength(2);
  });

  it('removes a revoked AI connection grant from discovery and prevents new chat', async () => {
    await query('delete from connection_grants where user_id=$1', [ALICE]);
    await actor();
    expect(await query('select * from connections')).toEqual([]);
    await denied(
      'select create_conversation($1,$2,$3)',
      [P_ALICE, 'No provider access', C],
      /CONNECTION_UNAVAILABLE/,
    );
    await admin();
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [ALICE, S_ALICE, Q_ALICE, randomUUID(), 'No access', 1000, M_ALICE],
      /CONNECTION_UNAVAILABLE/,
    );
  });
});

describe('Run lifecycle and atomic budget admission', () => {
  const connectionConfig = (overrides: Record<string, unknown> = {}) => ({
    id: C,
    provider: 'openai',
    name: 'Configured AI',
    model: 'fixture-text',
    enabled: true,
    input_price: 1,
    output_price: 2,
    max_output_tokens: 1000,
    grants: [ALICE, BOB],
    ...overrides,
  });

  it('keeps provider immutable, rejects cross-workspace configuration and filters foreign grants', async () => {
    await query('select save_connection($1,$2,$3,$4)', [
      OWNER,
      S_OWNER,
      JSON.stringify(connectionConfig({ grants: [ALICE, OUTSIDER] })),
      null,
    ]);
    expect(
      (
        await query<{ user_id: string }>(
          'select user_id from connection_grants where connection_id=$1',
          [C],
        )
      ).map((g) => g.user_id),
    ).toEqual([ALICE]);
    expect(
      (
        await query<{ ciphertext: string }>(
          'select ciphertext from private.connection_secrets where connection_id=$1',
          [C],
        )
      )[0]!.ciphertext,
    ).toBe('synthetic encrypted fixture');
    await denied(
      'select save_connection($1,$2,$3,$4)',
      [
        OWNER,
        S_OWNER,
        JSON.stringify(connectionConfig({ provider: 'google' })),
        'other provider secret',
      ],
      /INVALID_INPUT/,
    );
    await denied(
      'select save_connection($1,$2,$3,$4)',
      [OWNER, S_OWNER, JSON.stringify(connectionConfig({ id: C_FOREIGN })), 'cross tenant secret'],
      /FORBIDDEN/,
    );
    await denied(
      'select save_connection($1,$2,$3,$4)',
      [ALICE, S_ALICE, JSON.stringify(connectionConfig()), 'employee privilege escalation'],
      /FORBIDDEN/,
    );
  });

  it('rejects new requests after a model change, while settling an existing run with its recorded prices', async () => {
    const r = await begin();
    await query('select save_connection($1,$2,$3,$4)', [
      OWNER,
      S_OWNER,
      JSON.stringify(
        connectionConfig({ model: 'different-model', input_price: 10, output_price: 20 }),
      ),
      null,
    ]);
    await finish(r.run.id);
    expect(
      Number(
        (
          await query<{ actual_cost: string }>('select actual_cost from runs where id=$1', [
            r.run.id,
          ])
        )[0]!.actual_cost,
      ),
    ).toBeCloseTo(0.00014, 6);
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [ALICE, S_ALICE, Q_ALICE, randomUUID(), 'Should create new branch', 1000, null],
      /MODEL_CHANGED/,
    );
    expect(
      (await query<{ model: string }>('select model from conversations where id=$1', [Q_ALICE]))[0]!
        .model,
    ).toBe('fixture-text');
    await actor();
    const branch = (
      await query<{ id: string }>('select create_conversation($1,$2,$3,$4) as id', [
        P_ALICE,
        'Explicit new-model branch',
        C,
        Q_ALICE,
      ])
    )[0]!.id;
    expect(
      (await query<{ model: string }>('select model from conversations where id=$1', [branch]))[0]!
        .model,
    ).toBe('different-model');
  });

  it('returns the token cap that was reserved, independently of earlier or later connection settings', async () => {
    // Simulate a request that read a larger token cap before the owner changed it.
    const before = (
      await query<{ max_output_tokens: number }>(
        'select max_output_tokens from connections where id=$1',
        [C],
      )
    )[0]!.max_output_tokens;
    expect(before).toBe(1000);
    await query('select save_connection($1,$2,$3,$4)', [
      OWNER,
      S_OWNER,
      JSON.stringify(connectionConfig({ max_output_tokens: 128 })),
      null,
    ]);
    const r = await begin();
    expect(r.run.max_output_tokens).toBe(128);
    expect(Number(r.run.reserved_cost)).toBeCloseTo(0.005352, 6);
    // A subsequent configuration change does not mutate the admitted run.
    await query('select save_connection($1,$2,$3,$4)', [
      OWNER,
      S_OWNER,
      JSON.stringify(connectionConfig({ max_output_tokens: 8192 })),
      null,
    ]);
    expect(
      (
        await query<{ max_output_tokens: number }>(
          'select max_output_tokens from runs where id=$1',
          [r.run.id],
        )
      )[0]!.max_output_tokens,
    ).toBe(128);
  });

  it('reserves money and saves the prompt before returning a new run; retries reuse it once', async () => {
    const request = randomUUID(),
      first = await begin(Q_ALICE, request),
      second = await begin(Q_ALICE, request);
    expect(first.is_new).toBe(true);
    expect(second.is_new).toBe(false);
    expect(second.run.id).toBe(first.run.id);
    expect(Number(first.run.reserved_cost)).toBeCloseTo(0.007096, 6);
    const rows = await query<{ role: string; content: string; status: string }>(
      'select role,content,status from messages where run_id=$1 order by sequence',
      [first.run.id],
    );
    expect(rows).toEqual([
      { role: 'user', content: 'A genuine new question', status: 'complete' },
      { role: 'assistant', content: '', status: 'streaming' },
    ]);
    expect(await query('select * from runs')).toHaveLength(1);
  });

  it('does not let two requests spend the same remaining workspace budget', async () => {
    await query('update workspaces set monthly_budget=$1 where id=$2', [0.01, W]);
    // PGlite serializes single-connection queries. This asserts persisted reservation
    // admission; a live PostgreSQL multi-connection lock test remains a release check.
    const attempts = await Promise.allSettled([
      begin(),
      begin(Q_BOB, randomUUID(), BOB, S_BOB, M_BOB),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
    expect(
      String((attempts.find((a) => a.status === 'rejected') as PromiseRejectedResult).reason),
    ).toContain('BUDGET_EXCEEDED');
  });

  it('enforces personal limits and rejects missing budget before creating messages', async () => {
    await query('update members set monthly_limit=$1 where user_id=$2', [0.001, ALICE]);
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [ALICE, S_ALICE, Q_ALICE, randomUUID(), 'Too expensive', 1000, M_ALICE],
      /BUDGET_EXCEEDED/,
    );
    expect(await query('select * from runs')).toEqual([]);
    expect(await query('select * from messages where conversation_id=$1', [Q_ALICE])).toHaveLength(
      1,
    );
    await query('update workspaces set monthly_budget=0 where id=$1', [W]);
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [OWNER, S_OWNER, Q_OWNER, randomUUID(), 'Owner budget', 1000, M_OWNER],
      /BUDGET_EXCEEDED/,
    );
  });

  it('serializes each conversation and rejects stale history after completion', async () => {
    const run = await begin();
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [ALICE, S_ALICE, Q_ALICE, randomUUID(), 'Overlapping', 1000, M_ALICE],
      /RUN_IN_PROGRESS/,
    );
    await finish(run.run.id);
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [ALICE, S_ALICE, Q_ALICE, randomUUID(), 'Stale context', 1000, M_ALICE],
      /CONVERSATION_CHANGED/,
    );
  });

  it('retains pending reservation and partial response after interrupted generation', async () => {
    const r = await begin();
    await query('select checkpoint_run($1,$2)', [r.run.id, 'Partial content']);
    await finish(r.run.id, 'interrupted', null, null);
    const row = (
      await query<{
        status: string;
        actual_cost: string | null;
        usage_state: string;
        reserved_cost: string;
      }>('select status,actual_cost,usage_state,reserved_cost from runs where id=$1', [r.run.id])
    )[0]!;
    expect(row).toMatchObject({ status: 'interrupted', actual_cost: null, usage_state: 'pending' });
    expect(Number(row.reserved_cost)).toBeCloseTo(0.007096, 6);
    expect(
      (
        await query<{ status: string }>('select status from messages where run_id=$1 and role=$2', [
          r.run.id,
          'assistant',
        ])
      )[0]!.status,
    ).toBe('partial');
    await actor();
    const summary = (
      await query<{ usage: { recorded: number; reserved: number; pending: number } }>(
        'select usage_summary() as usage',
      )
    )[0]!.usage;
    expect(summary.recorded).toBe(0);
    expect(summary.pending).toBe(1);
    expect(Number(summary.reserved)).toBeCloseTo(0.007096, 6);
  });

  it('settles actual tokens exactly once and late checkpoints cannot overwrite the final answer', async () => {
    const r = await begin();
    await finish(r.run.id);
    await finish(r.run.id, 'failed', 2000, 2000);
    await query('select checkpoint_run($1,$2)', [r.run.id, 'Late stale output']);
    const row = (
      await query<{ actual_cost: string; status: string; usage_state: string }>(
        'select actual_cost,status,usage_state from runs where id=$1',
        [r.run.id],
      )
    )[0]!;
    expect(Number(row.actual_cost)).toBeCloseTo(0.00014, 6);
    expect(row.status).toBe('completed');
    expect(row.usage_state).toBe('recorded');
    expect(
      (
        await query<{ content: string }>(
          'select content from messages where run_id=$1 and role=$2',
          [r.run.id, 'assistant'],
        )
      )[0]!.content,
    ).toBe('Answer retained in database');
  });

  it('rechecks cancellation, sharing, archive, connection grants and session expiry during streaming', async () => {
    const r = await begin();
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(true);
    await actor();
    await query('select request_stop($1)', [r.run.id]);
    await admin();
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(false);
    await query('update runs set cancel_requested=false where id=$1', [r.run.id]);
    await query('delete from connection_grants where connection_id=$1 and user_id=$2', [C, ALICE]);
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(false);
    await query('insert into connection_grants(connection_id,user_id) values($1,$2)', [C, ALICE]);
    await query('update projects set archived_at=now() where id=$1', [P_ALICE]);
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(false);
    await query('update projects set archived_at=null where id=$1', [P_ALICE]);
    await query('update private.hub_sessions set expires_at=now() where session_id=$1', [S_ALICE]);
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(false);
  });

  it('stops a contributor’s running generation when project sharing is revoked', async () => {
    await query(
      "update project_members set permission='contributor' where project_id=$1 and user_id=$2",
      [P_ALICE, BOB],
    );
    const r = await begin(Q_ALICE, randomUUID(), BOB, S_BOB, M_ALICE);
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(true);
    await query('delete from project_members where project_id=$1 and user_id=$2', [P_ALICE, BOB]);
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(false);
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [BOB, S_BOB, Q_ALICE, randomUUID(), 'No longer shared', 1000, M_ALICE],
      /FORBIDDEN/,
    );
  });

  it('stops generation after disabling a connection and blocks every subsequent request', async () => {
    const r = await begin();
    await query('select save_connection($1,$2,$3,$4)', [
      OWNER,
      S_OWNER,
      JSON.stringify(connectionConfig({ enabled: false })),
      null,
    ]);
    expect(
      (await query<{ ok: boolean }>('select run_can_continue($1) as ok', [r.run.id]))[0]!.ok,
    ).toBe(false);
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [BOB, S_BOB, Q_BOB, randomUUID(), 'Disabled connection', 1000, M_BOB],
      /CONNECTION_UNAVAILABLE/,
    );
  });

  it('rejects reuse of an idempotency key for a different conversation', async () => {
    const request = randomUUID();
    await begin(Q_ALICE, request);
    await query(
      'insert into public.conversations(project_id,created_by,title,connection_id,model) values($1,$2,$3,$4,$5) returning id',
      [P_ALICE, ALICE, 'Second Alice conversation', C, 'fixture-text'],
    );
    const newId = (
      await query<{ id: string }>('select id from conversations where title=$1', [
        'Second Alice conversation',
      ])
    )[0]!.id;
    await denied(
      'select begin_run($1,$2,$3,$4,$5,$6,$7)',
      [ALICE, S_ALICE, newId, request, 'Different intent', 1000, null],
      /IDEMPOTENCY_CONFLICT/,
    );
    expect(await query('select id from runs')).toHaveLength(1);
  });

  it('keeps each employee usage private while owner sees totals', async () => {
    const a = await begin();
    await finish(a.run.id);
    const b = await begin(Q_BOB, randomUUID(), BOB, S_BOB, M_BOB);
    await finish(b.run.id);
    await actor();
    expect(
      (await query<{ actor_id: string }>('select actor_id from runs')).map((r) => r.actor_id),
    ).toEqual([ALICE]);
    expect(
      (await query<{ usage: { runs: number } }>('select usage_summary() as usage'))[0]!.usage.runs,
    ).toBe(1);
    await actor(OWNER, S_OWNER);
    expect(
      (await query<{ usage: { runs: number } }>('select usage_summary() as usage'))[0]!.usage.runs,
    ).toBe(2);
  });

  it('reconciles an old interrupted run with explicit owner input and preserves the audit record', async () => {
    const r = await begin();
    await denied(
      'select reconcile_run($1,$2,$3,$4)',
      [OWNER, S_OWNER, r.run.id, 0],
      /RUN_IN_PROGRESS/,
    );
    await query("update runs set heartbeat_at=now()-interval '11 minutes' where id=$1", [r.run.id]);
    await query('select reconcile_run($1,$2,$3,$4)', [OWNER, S_OWNER, r.run.id, 0.003]);
    expect(
      (
        await query<{ usage_state: string; status: string; actual_cost: string }>(
          'select usage_state,status,actual_cost from runs where id=$1',
          [r.run.id],
        )
      )[0],
    ).toEqual({ usage_state: 'reconciled', status: 'interrupted', actual_cost: '0.003000' });
    expect(
      await query('select id from audit_events where action=$1 and resource_id=$2', [
        'usage.reconcile',
        r.run.id,
      ]),
    ).toHaveLength(1);
  });
});

describe('History imports and branches', () => {
  const items = [
    {
      title: 'Imported history',
      source: 'openai',
      source_id: 'source-id',
      hash: 'fixture-content-hash',
      messages: [
        { role: 'user', content: 'Original question', created_at: '2026-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Original answer' },
      ],
    },
  ];
  it('imports atomically, deduplicates repeat input and preserves unknown original authors', async () => {
    const first = (
      await query<{ result: { imported: number; duplicates: number } }>(
        'select import_conversations($1,$2,$3,$4) as result',
        [OWNER, S_OWNER, P_OWNER, JSON.stringify(items)],
      )
    )[0]!.result;
    const second = (
      await query<{ result: { imported: number; duplicates: number } }>(
        'select import_conversations($1,$2,$3,$4) as result',
        [OWNER, S_OWNER, P_OWNER, JSON.stringify(items)],
      )
    )[0]!.result;
    expect(first).toEqual({ imported: 1, duplicates: 0 });
    expect(second).toEqual({ imported: 0, duplicates: 1 });
    const conv = (
      await query<{ id: string; created_by: string | null; imported_by: string }>(
        'select id,created_by,imported_by from conversations where import_hash=$1',
        [items[0]!.hash],
      )
    )[0]!;
    expect(conv.created_by).toBeNull();
    expect(conv.imported_by).toBe(OWNER);
    expect(
      await query('select author_id from messages where conversation_id=$1', [conv.id]),
    ).toEqual([{ author_id: null }, { author_id: null }]);
  });

  it('does not let owner import into a read-only or foreign project', async () => {
    await denied(
      'select import_conversations($1,$2,$3,$4)',
      [OWNER, S_OWNER, P_ALICE, JSON.stringify(items)],
      /FORBIDDEN/,
    );
    await denied(
      'select import_conversations($1,$2,$3,$4)',
      [OWNER, S_OWNER, P_FOREIGN, JSON.stringify(items)],
      /FORBIDDEN/,
    );
    await denied(
      'select import_conversations($1,$2,$3,$4)',
      [ALICE, S_ALICE, P_ALICE, JSON.stringify(items)],
      /FORBIDDEN/,
    );
  });

  it('rolls back an entire import batch when one message violates the schema', async () => {
    const bad = [
      ...items,
      {
        ...items[0],
        hash: 'bad-item',
        messages: [{ role: 'unsupported', content: 'Invalid role' }],
      },
    ];
    await denied(
      'select import_conversations($1,$2,$3,$4)',
      [OWNER, S_OWNER, P_OWNER, JSON.stringify(bad)],
      /check constraint/,
    );
    expect(await query('select id from conversations where import_hash is not null')).toEqual([]);
  });

  it('branches only within the same project and copies complete messages without altering the source', async () => {
    await actor();
    const id = (
      await query<{ id: string }>('select create_conversation($1,$2,$3,$4) as id', [
        P_ALICE,
        'New branch',
        C,
        Q_ALICE,
      ])
    )[0]!.id;
    expect(
      (
        await query<{ parent_id: string }>('select parent_id from conversations where id=$1', [id])
      )[0]!.parent_id,
    ).toBe(Q_ALICE);
    expect(
      (
        await query<{ content: string }>('select content from messages where conversation_id=$1', [
          id,
        ])
      )[0]!.content,
    ).toBe('alicekeyword private message');
    expect(
      (await query<{ model: string }>('select model from conversations where id=$1', [Q_ALICE]))[0]!
        .model,
    ).toBe('fixture-text');
    await denied(
      'select create_conversation($1,$2,$3,$4)',
      [P_ALICE, 'Steal history', C, Q_BOB],
      /FORBIDDEN/,
    );
  });
});
