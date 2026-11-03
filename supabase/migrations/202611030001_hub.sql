-- Fresh project migration. Never apply to an unrelated application database.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  monthly_budget numeric(14,6) not null default 0 check (monthly_budget >= 0),
  warning_percent integer not null default 80 check (warning_percent between 1 and 99),
  created_at timestamptz not null default now()
);
create table public.members (
  user_id uuid primary key references auth.users(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id),
  email text not null,
  display_name text not null check (length(display_name) between 1 and 100),
  role text not null check (role in ('owner','employee')),
  status text not null default 'active' check (status in ('active','suspended')),
  monthly_limit numeric(14,6) not null default 0 check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  unique(workspace_id,email), unique(workspace_id,user_id)
);
create unique index one_workspace_owner on public.members(workspace_id) where role='owner';
create table private.hub_sessions (
  session_id uuid primary key,
  user_id uuid not null references public.members(user_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz
);
create index sessions_user on private.hub_sessions(user_id);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  created_by uuid not null,
  name text not null check (length(name) between 1 and 100),
  description text not null default '' check (length(description)<=1000),
  category text not null default 'Nghiên cứu' check (length(category)<=50),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(workspace_id,created_by) references public.members(workspace_id,user_id)
);
create index projects_workspace_updated on public.projects(workspace_id,updated_at desc,id);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.members(user_id),
  permission text not null check(permission in ('viewer','contributor')),
  primary key(project_id,user_id)
);
create index project_members_user on public.project_members(user_id,project_id);
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  provider text not null check(provider in ('openai','anthropic','google')),
  name text not null check(length(name) between 1 and 100),
  model text not null check(length(model) between 1 and 120),
  enabled boolean not null default false,
  input_price numeric(14,6) not null check(input_price>=0),
  output_price numeric(14,6) not null check(output_price>=0),
  max_output_tokens integer not null default 2048 check(max_output_tokens between 128 and 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index connections_workspace on public.connections(workspace_id);
create table private.connection_secrets (
  connection_id uuid primary key references public.connections(id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);
create table public.connection_grants (
  connection_id uuid not null references public.connections(id) on delete cascade,
  user_id uuid not null references public.members(user_id),
  primary key(connection_id,user_id)
);
create index connection_grants_user on public.connection_grants(user_id,connection_id);
create table public.provider_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  provider text not null check(provider in ('openai','anthropic','google','meta')),
  label text not null check(length(label) between 1 and 100),
  plan text not null default '' check(length(plan)<=100),
  renewal_date date,
  notes text not null default '' check(length(notes)<=1000),
  unique(workspace_id,provider)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  created_by uuid references public.members(user_id),
  title text not null check(length(title) between 1 and 200),
  connection_id uuid references public.connections(id),
  model text,
  source text not null default 'hub' check(source in ('hub','openai','anthropic','google','meta','normalized')),
  source_id text,
  import_hash text,
  imported_by uuid references public.members(user_id),
  parent_id uuid references public.conversations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,import_hash)
);
create index conversations_project_updated on public.conversations(project_id,updated_at desc,id);
create index conversations_search on public.conversations using gin(to_tsvector('simple',title));
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  workspace_id uuid not null references public.workspaces(id),
  actor_id uuid not null references public.members(user_id),
  session_id uuid not null,
  conversation_id uuid not null references public.conversations(id),
  connection_id uuid not null references public.connections(id),
  model text not null,
  max_output_tokens integer not null check(max_output_tokens between 128 and 8192),
  status text not null default 'running' check(status in ('running','completed','failed','cancelled','interrupted')),
  reserved_cost numeric(14,6) not null check(reserved_cost>=0),
  actual_cost numeric(14,6) check(actual_cost>=0),
  input_price numeric(14,6) not null,
  output_price numeric(14,6) not null,
  input_tokens bigint check(input_tokens>=0),
  output_tokens bigint check(output_tokens>=0),
  usage_state text not null default 'pending' check(usage_state in ('pending','recorded','reconciled')),
  cancel_requested boolean not null default false,
  error_code text,
  created_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(actor_id,request_id)
);
create unique index one_running_per_conversation on public.runs(conversation_id) where status='running';
create index runs_workspace_month on public.runs(workspace_id,created_at desc);
create index runs_actor_month on public.runs(actor_id,created_at desc);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity,
  conversation_id uuid not null references public.conversations(id),
  run_id uuid references public.runs(id),
  role text not null check(role in ('user','assistant','system')),
  content text not null default '' check(octet_length(content)<=1000000),
  author_id uuid references public.members(user_id),
  status text not null default 'complete' check(status in ('complete','streaming','partial','failed')),
  created_at timestamptz not null default now(),
  unique(run_id,role)
);
create index messages_conversation_sequence on public.messages(conversation_id,sequence);
create index messages_search on public.messages using gin(to_tsvector('simple',content));
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  uploaded_by uuid not null references public.members(user_id),
  name text not null check(length(name) between 1 and 180),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check(size_bytes between 0 and 3000000),
  text_content text check(octet_length(text_content)<=120000),
  created_at timestamptz not null default now()
);
create index documents_project on public.documents(project_id,created_at desc);
create table public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id),
  actor_id uuid references public.members(user_id),
  action text not null,
  resource_id text,
  created_at timestamptz not null default now()
);
create index audit_workspace_date on public.audit_events(workspace_id,created_at desc);
create table private.rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 1
);

-- Helpers are security-definer to prevent recursive RLS; search_path is fixed.
create function private.session_active(p_user uuid,p_session uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.hub_sessions s join public.members m on m.user_id=s.user_id
    where s.session_id=p_session and s.user_id=p_user and s.revoked_at is null
      and s.expires_at>now() and m.status='active');
$$;
create function private.workspace_id() returns uuid
language sql stable security definer set search_path='' as $$
  select m.workspace_id from public.members m where m.user_id=auth.uid()
    and private.session_active(auth.uid(),nullif(auth.jwt()->>'session_id','')::uuid);
$$;
create function private.is_owner(p_workspace uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.members m where m.user_id=auth.uid() and m.workspace_id=p_workspace
    and m.role='owner' and m.workspace_id=private.workspace_id());
$$;
create function private.can_read_project(p_project uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.projects p where p.id=p_project and p.workspace_id=private.workspace_id()
    and (private.is_owner(p.workspace_id) or p.created_by=auth.uid() or exists(
      select 1 from public.project_members pm where pm.project_id=p.id and pm.user_id=auth.uid())));
$$;
create function private.can_write_project(p_project uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.projects p where p.id=p_project and p.workspace_id=private.workspace_id()
    and p.archived_at is null and (p.created_by=auth.uid() or exists(
      select 1 from public.project_members pm where pm.project_id=p.id and pm.user_id=auth.uid() and pm.permission='contributor')));
$$;
create function private.manages_project(p_project uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.projects p where p.id=p_project and p.workspace_id=private.workspace_id() and p.created_by=auth.uid());
$$;
create function private.can_read_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.conversations c where c.id=p_conversation and private.can_read_project(c.project_id));
$$;
create function private.connection_workspace(p_connection uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select workspace_id from public.connections where id=p_connection;
$$;

alter table public.workspaces enable row level security;
alter table public.members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.connections enable row level security;
alter table public.connection_grants enable row level security;
alter table public.provider_accounts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.runs enable row level security;
alter table public.documents enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon,authenticated;
grant select on public.workspaces,public.members,public.projects,public.project_members,public.connections,
  public.connection_grants,public.provider_accounts,public.conversations,public.messages,public.runs,public.documents,public.audit_events to authenticated;
grant insert on public.projects to authenticated;
grant insert on public.documents to authenticated;
grant update(name,description,category,archived_at,updated_at) on public.projects to authenticated;
grant insert,update,delete on public.project_members to authenticated;
grant update(display_name) on public.members to authenticated;
grant update(name,monthly_budget,warning_percent) on public.workspaces to authenticated;
grant insert,update on public.provider_accounts to authenticated;
grant all on all tables in schema public to service_role;
grant all on all tables in schema private to service_role;
grant all on all sequences in schema public to service_role;

create policy workspace_read on public.workspaces for select to authenticated using(id=private.workspace_id());
create policy workspace_edit on public.workspaces for update to authenticated using(private.is_owner(id)) with check(private.is_owner(id));
create policy member_read on public.members for select to authenticated using(workspace_id=private.workspace_id());
create policy member_self_name on public.members for update to authenticated using(user_id=auth.uid() and workspace_id=private.workspace_id()) with check(user_id=auth.uid());
create policy project_read on public.projects for select to authenticated using(private.can_read_project(id));
create policy project_create on public.projects for insert to authenticated with check(workspace_id=private.workspace_id() and created_by=auth.uid());
create policy project_edit on public.projects for update to authenticated using(private.manages_project(id)) with check(private.manages_project(id));
create policy project_members_read on public.project_members for select to authenticated using(private.can_read_project(project_id));
create policy project_members_write on public.project_members for all to authenticated using(private.manages_project(project_id)) with check(private.manages_project(project_id)
  and exists(select 1 from public.members m where m.user_id=project_members.user_id and m.workspace_id=private.workspace_id()));
create policy connection_read on public.connections for select to authenticated using(workspace_id=private.workspace_id() and (private.is_owner(workspace_id) or exists(select 1 from public.connection_grants g where g.connection_id=connections.id and g.user_id=auth.uid())));
create policy connection_grants_read on public.connection_grants for select to authenticated using(
  private.connection_workspace(connection_id)=private.workspace_id() and (user_id=auth.uid() or private.is_owner(private.workspace_id())));
create policy accounts_owner on public.provider_accounts for all to authenticated using(private.is_owner(workspace_id)) with check(private.is_owner(workspace_id));
create policy conversation_read on public.conversations for select to authenticated using(private.can_read_project(project_id));
create policy messages_read on public.messages for select to authenticated using(private.can_read_conversation(conversation_id));
create policy runs_read on public.runs for select to authenticated using(workspace_id=private.workspace_id() and (actor_id=auth.uid() or private.is_owner(workspace_id)));
create policy documents_read on public.documents for select to authenticated using(private.can_read_project(project_id));
create policy documents_create on public.documents for insert to authenticated with check(
  private.can_write_project(project_id) and uploaded_by=auth.uid()
  and starts_with(storage_path,project_id::text||'/'||id::text||'/')
);
create policy audit_owner on public.audit_events for select to authenticated using(private.is_owner(workspace_id));

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare w uuid; rid text;
begin
  if TG_TABLE_NAME='projects' then w:=NEW.workspace_id; rid:=NEW.id::text;
  elsif TG_TABLE_NAME='workspaces' then w:=NEW.id; rid:=NEW.id::text;
  elsif TG_TABLE_NAME='members' then w:=NEW.workspace_id; rid:=NEW.user_id::text;
  elsif TG_TABLE_NAME='provider_accounts' then w:=NEW.workspace_id; rid:=NEW.id::text;
  else
    select workspace_id into w from public.projects where id=coalesce(NEW.project_id,OLD.project_id);
    rid:=coalesce(NEW.project_id,OLD.project_id)::text;
  end if;
  insert into public.audit_events(workspace_id,actor_id,action,resource_id) values(w,auth.uid(),lower(TG_TABLE_NAME||'.'||TG_OP),rid);
  return coalesce(NEW,OLD);
end $$;
create trigger project_audit after insert or update on public.projects for each row execute function private.audit_change();
create trigger sharing_audit after insert or update or delete on public.project_members for each row execute function private.audit_change();
create trigger workspace_audit after update on public.workspaces for each row execute function private.audit_change();
create trigger member_audit after update on public.members for each row execute function private.audit_change();
create trigger account_audit after insert or update on public.provider_accounts for each row execute function private.audit_change();

-- Public RPCs perform explicit authorization; service-only RPCs are revoked below.
create function public.session_info() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('expires_at',s.expires_at,'session_id',s.session_id) from private.hub_sessions s
  where s.session_id=nullif(auth.jwt()->>'session_id','')::uuid and private.session_active(auth.uid(),s.session_id);
$$;
create function public.revoke_session() returns void language plpgsql security definer set search_path='' as $$
begin update private.hub_sessions set revoked_at=now() where user_id=auth.uid() and session_id=nullif(auth.jwt()->>'session_id','')::uuid; end $$;
create function public.revoke_all_sessions() returns void language plpgsql security definer set search_path='' as $$
begin
  if private.workspace_id() is null then raise exception 'FORBIDDEN'; end if;
  update private.hub_sessions set revoked_at=now() where user_id=auth.uid();
  update public.runs set cancel_requested=true where actor_id=auth.uid() and status='running';
end $$;
create function public.record_access(p_project uuid,p_action text,p_resource text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.can_read_project(p_project) or p_action not in ('conversation.read','conversation.export','document.download') then raise exception 'FORBIDDEN'; end if;
  insert into public.audit_events(workspace_id,actor_id,action,resource_id) select workspace_id,auth.uid(),p_action,left(p_resource,100) from public.projects where id=p_project;
end $$;
create function public.create_conversation(p_project uuid,p_title text,p_connection uuid,p_parent uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.connections; pid uuid; cid uuid;
begin
  if not private.can_write_project(p_project) then raise exception 'FORBIDDEN'; end if;
  select * into c from public.connections where id=p_connection and workspace_id=private.workspace_id() and enabled;
  if c.id is null or (not private.is_owner(c.workspace_id) and not exists(select 1 from public.connection_grants where connection_id=c.id and user_id=auth.uid())) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
  if p_parent is not null then
    select project_id into pid from public.conversations where id=p_parent;
    if pid is distinct from p_project or not private.can_read_conversation(p_parent) then raise exception 'FORBIDDEN'; end if;
    if exists(select 1 from public.runs where conversation_id=p_parent and status='running') then raise exception 'RUN_IN_PROGRESS'; end if;
  end if;
  insert into public.conversations(project_id,created_by,title,connection_id,model,parent_id) values(p_project,auth.uid(),p_title,c.id,c.model,p_parent) returning id into cid;
  if p_parent is not null then
    insert into public.messages(conversation_id,role,content,author_id,status)
      select cid,role,content,author_id,status from public.messages where conversation_id=p_parent and status='complete' order by sequence;
  end if;
  return cid;
end $$;
create function public.search_conversations(p_query text default '',p_project uuid default null,p_source text default null,p_offset integer default 0) returns setof public.conversations
language sql stable security invoker set search_path='' as $$
  select c.* from public.conversations c where (p_project is null or c.project_id=p_project) and (p_source is null or c.source=p_source)
    and (p_query='' or to_tsvector('simple',c.title) @@ plainto_tsquery('simple',left(p_query,200)) or exists(
      select 1 from public.messages m where m.conversation_id=c.id and to_tsvector('simple',m.content) @@ plainto_tsquery('simple',left(p_query,200))))
  order by c.updated_at desc,c.id limit 30 offset greatest(0,least(p_offset,10000));
$$;
create function public.usage_summary() returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('recorded',coalesce(sum(actual_cost),0),'reserved',coalesce(sum(reserved_cost) filter(where actual_cost is null),0),
    'runs',count(*),'pending',count(*) filter(where actual_cost is null)) from public.runs
  where created_at >= date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
$$;
create function public.request_stop(p_run uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if private.workspace_id() is null then raise exception 'FORBIDDEN'; end if;
  update public.runs set cancel_requested=true where id=p_run and actor_id=auth.uid() and workspace_id=private.workspace_id() and status='running';
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Service-only administrative operations, called after server-side authentication.
create function public.register_hub_session(p_user uuid,p_session uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.members where user_id=p_user and status='active') then raise exception 'FORBIDDEN'; end if;
  insert into private.hub_sessions(session_id,user_id) values(p_session,p_user) on conflict(session_id) do nothing;
end $$;
create function public.consume_rate_limit(p_key text,p_limit integer,p_window integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
  insert into private.rate_limits(key,hits) values(p_key,1) on conflict(key) do update set
    hits=case when private.rate_limits.window_start<now()-make_interval(secs=>p_window) then 1 else private.rate_limits.hits+1 end,
    window_start=case when private.rate_limits.window_start<now()-make_interval(secs=>p_window) then now() else private.rate_limits.window_start end
    returning hits into n;
  return n<=p_limit;
end $$;
create function public.get_connection_secret(p_connection uuid) returns text language sql stable security definer set search_path='' as $$
  select ciphertext from private.connection_secrets where connection_id=p_connection;
$$;
create function public.save_connection(p_actor uuid,p_session uuid,p_data jsonb,p_ciphertext text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid; cid uuid;
begin
  select workspace_id into w from public.members where user_id=p_actor and role='owner' and private.session_active(p_actor,p_session);
  if w is null then raise exception 'FORBIDDEN'; end if;
  cid:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  if exists(select 1 from public.connections where id=cid and workspace_id<>w) then raise exception 'FORBIDDEN'; end if;
  if exists(select 1 from public.connections where id=cid and provider<>p_data->>'provider') then raise exception 'INVALID_INPUT'; end if;
  if not exists(select 1 from private.connection_secrets where connection_id=cid) and p_ciphertext is null then raise exception 'KEY_REQUIRED'; end if;
  insert into public.connections(id,workspace_id,provider,name,model,enabled,input_price,output_price,max_output_tokens)
    values(cid,w,p_data->>'provider',p_data->>'name',p_data->>'model',(p_data->>'enabled')::boolean,(p_data->>'input_price')::numeric,(p_data->>'output_price')::numeric,(p_data->>'max_output_tokens')::integer)
    on conflict(id) do update set name=excluded.name,model=excluded.model,enabled=excluded.enabled,input_price=excluded.input_price,output_price=excluded.output_price,max_output_tokens=excluded.max_output_tokens,updated_at=now();
  if p_ciphertext is not null then insert into private.connection_secrets(connection_id,ciphertext) values(cid,p_ciphertext)
    on conflict(connection_id) do update set ciphertext=excluded.ciphertext,updated_at=now(); end if;
  delete from public.connection_grants where connection_id=cid;
  insert into public.connection_grants(connection_id,user_id) select cid,m.user_id from public.members m
    where m.workspace_id=w and m.status='active' and m.user_id in (select jsonb_array_elements_text(p_data->'grants')::uuid);
  insert into public.audit_events(workspace_id,actor_id,action,resource_id) values(w,p_actor,'connection.save',cid::text);
  return cid;
end $$;
create function public.update_employee(p_actor uuid,p_session uuid,p_user uuid,p_status text,p_limit numeric) returns void language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
  select workspace_id into w from public.members where user_id=p_actor and role='owner' and private.session_active(p_actor,p_session);
  if w is null then raise exception 'FORBIDDEN'; end if;
  update public.members set status=p_status,monthly_limit=p_limit where user_id=p_user and workspace_id=w and role='employee';
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status='suspended' then
    update private.hub_sessions set revoked_at=now() where user_id=p_user;
    update public.runs set cancel_requested=true where actor_id=p_user and status='running';
  end if;
  insert into public.audit_events(workspace_id,actor_id,action,resource_id) values(w,p_actor,'employee.update',p_user::text);
end $$;

create function public.begin_run(p_actor uuid,p_session uuid,p_conversation uuid,p_request uuid,p_prompt text,p_input_upper integer,p_last_message uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.conversations; p public.projects; cfg public.connections; m public.members; w public.workspaces; r public.runs; reserve numeric; used numeric; personal numeric; last_id uuid;
begin
  if not private.session_active(p_actor,p_session) then raise exception 'FORBIDDEN'; end if;
  select * into c from public.conversations where id=p_conversation;
  select * into p from public.projects where id=c.project_id;
  select * into m from public.members where user_id=p_actor;
  if p.workspace_id is distinct from m.workspace_id or p.archived_at is not null or not (p.created_by=p_actor or exists(select 1 from public.project_members where project_id=p.id and user_id=p_actor and permission='contributor')) then raise exception 'FORBIDDEN'; end if;
  select * into w from public.workspaces where id=p.workspace_id for update;
  -- Waiting for the workspace budget lock must not preserve an authorization
  -- decision made before an employee/session/project was revoked.
  if not private.session_active(p_actor,p_session) then raise exception 'FORBIDDEN'; end if;
  select * into p from public.projects where id=c.project_id;
  select * into m from public.members where user_id=p_actor;
  if p.workspace_id is distinct from m.workspace_id or p.archived_at is not null or not (p.created_by=p_actor or exists(select 1 from public.project_members where project_id=p.id and user_id=p_actor and permission='contributor')) then raise exception 'FORBIDDEN'; end if;
  select * into r from public.runs where actor_id=p_actor and request_id=p_request;
  if found then
    if r.conversation_id<>p_conversation then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('run',to_jsonb(r),'is_new',false);
  end if;
  select * into cfg from public.connections where id=c.connection_id and workspace_id=w.id and enabled;
  if cfg.id is null or (m.role<>'owner' and not exists(select 1 from public.connection_grants where connection_id=cfg.id and user_id=p_actor)) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
  if cfg.model<>c.model then raise exception 'MODEL_CHANGED'; end if;
  if exists(select 1 from public.runs where conversation_id=c.id and status='running') then raise exception 'RUN_IN_PROGRESS'; end if;
  select id into last_id from public.messages where conversation_id=c.id order by sequence desc limit 1;
  if last_id is distinct from p_last_message then raise exception 'CONVERSATION_CHANGED'; end if;
  if p_input_upper not between 1 and 200000 or length(btrim(p_prompt)) not between 1 and 20000 then raise exception 'INVALID_INPUT'; end if;
  reserve:=ceil(((p_input_upper+4096)*cfg.input_price+cfg.max_output_tokens*cfg.output_price))/1000000;
  select coalesce(sum(coalesce(actual_cost,reserved_cost)),0),coalesce(sum(coalesce(actual_cost,reserved_cost)) filter(where actor_id=p_actor),0) into used,personal
    from public.runs where workspace_id=w.id and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  if w.monthly_budget<=0 or used+reserve>w.monthly_budget or (m.role<>'owner' and (m.monthly_limit<=0 or personal+reserve>m.monthly_limit)) then raise exception 'BUDGET_EXCEEDED'; end if;
  insert into public.runs(request_id,workspace_id,actor_id,session_id,conversation_id,connection_id,model,max_output_tokens,reserved_cost,input_price,output_price)
    values(p_request,w.id,p_actor,p_session,c.id,cfg.id,c.model,cfg.max_output_tokens,reserve,cfg.input_price,cfg.output_price) returning * into r;
  insert into public.messages(conversation_id,run_id,role,content,author_id) values(c.id,r.id,'user',p_prompt,p_actor);
  insert into public.messages(conversation_id,run_id,role,content,status) values(c.id,r.id,'assistant','','streaming');
  update public.conversations set updated_at=now() where id=c.id;
  update public.projects set updated_at=now() where id=p.id;
  return jsonb_build_object('run',to_jsonb(r),'is_new',true);
end $$;
create function public.run_can_continue(p_run uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.runs r join public.projects p on p.id=(select project_id from public.conversations where id=r.conversation_id)
    join public.members m on m.user_id=r.actor_id join public.connections c on c.id=r.connection_id
    where r.id=p_run and r.status='running' and not r.cancel_requested and p.archived_at is null and c.enabled
    and private.session_active(r.actor_id,r.session_id) and (p.created_by=r.actor_id or exists(select 1 from public.project_members pm where pm.project_id=p.id and pm.user_id=r.actor_id and pm.permission='contributor'))
    and (m.role='owner' or exists(select 1 from public.connection_grants g where g.connection_id=c.id and g.user_id=r.actor_id)));
$$;
create function public.checkpoint_run(p_run uuid,p_text text) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.runs set heartbeat_at=now() where id=p_run and status='running';
  if found then update public.messages set content=p_text where run_id=p_run and role='assistant' and status='streaming'; end if;
end $$;
create function public.finish_run(p_run uuid,p_status text,p_text text,p_input bigint default null,p_output bigint default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare r public.runs; total numeric;
begin
  perform 1 from public.workspaces where id=(select workspace_id from public.runs where id=p_run) for update;
  select * into r from public.runs where id=p_run for update;
  if r.id is null or r.status<>'running' then return; end if;
  if p_status not in ('completed','failed','cancelled','interrupted') then raise exception 'INVALID_INPUT'; end if;
  if p_input is not null and p_output is not null then total:=(p_input*r.input_price+p_output*r.output_price)/1000000; end if;
  update public.runs set status=p_status,actual_cost=total,input_tokens=p_input,output_tokens=p_output,usage_state=case when total is null then 'pending' else 'recorded' end,error_code=p_error,finished_at=now(),heartbeat_at=now() where id=p_run;
  update public.messages set content=p_text,status=case when p_status='completed' then 'complete' when p_text<>'' then 'partial' else 'failed' end where run_id=p_run and role='assistant';
  update public.conversations set updated_at=now() where id=r.conversation_id;
end $$;
create function public.reconcile_run(p_actor uuid,p_session uuid,p_run uuid,p_actual numeric) returns void language plpgsql security definer set search_path='' as $$
declare w uuid; r public.runs;
begin
  select workspace_id into w from public.members where user_id=p_actor and role='owner' and private.session_active(p_actor,p_session);
  if w is null then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.workspaces where id=w for update;
  select * into r from public.runs where id=p_run and workspace_id=w for update;
  if r.id is null or p_actual<0 then raise exception 'NOT_FOUND'; end if;
  if r.status='running' and r.heartbeat_at>now()-interval '10 minutes' then raise exception 'RUN_IN_PROGRESS'; end if;
  update public.runs set actual_cost=p_actual,usage_state='reconciled',status=case when status='running' then 'interrupted' else status end,finished_at=coalesce(finished_at,now()) where id=p_run;
  update public.messages set status='partial' where run_id=p_run and status='streaming';
  insert into public.audit_events(workspace_id,actor_id,action,resource_id) values(w,p_actor,'usage.reconcile',p_run::text);
end $$;

create function public.import_conversations(p_actor uuid,p_session uuid,p_project uuid,p_items jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w uuid; p public.projects; item jsonb; msg jsonb; cid uuid; added integer:=0; skipped integer:=0;
begin
  select workspace_id into w from public.members where user_id=p_actor and role='owner' and private.session_active(p_actor,p_session);
  select * into p from public.projects where id=p_project;
  if w is null or p.workspace_id is distinct from w or p.archived_at is not null or not(p.created_by=p_actor or exists(select 1 from public.project_members where project_id=p.id and user_id=p_actor and permission='contributor')) then raise exception 'FORBIDDEN'; end if;
  if jsonb_array_length(p_items)>50 then raise exception 'INVALID_INPUT'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    cid:=null;
    insert into public.conversations(project_id,title,source,source_id,import_hash,imported_by)
      values(p_project,item->>'title',item->>'source',item->>'source_id',item->>'hash',p_actor)
      on conflict(project_id,import_hash) do nothing returning id into cid;
    if cid is null then skipped:=skipped+1; continue; end if;
    for msg in select * from jsonb_array_elements(item->'messages') loop
      insert into public.messages(conversation_id,role,content,created_at) values(cid,msg->>'role',msg->>'content',coalesce(nullif(msg->>'created_at','')::timestamptz,now()));
    end loop;
    added:=added+1;
  end loop;
  insert into public.audit_events(workspace_id,actor_id,action,resource_id) values(w,p_actor,'history.import',p_project::text);
  return jsonb_build_object('imported',added,'duplicates',skipped);
end $$;

revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.workspace_id(),private.is_owner(uuid),private.can_read_project(uuid),private.can_write_project(uuid),private.manages_project(uuid),private.can_read_conversation(uuid),private.connection_workspace(uuid) to authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.session_info(),public.revoke_session(),public.revoke_all_sessions(),public.record_access(uuid,text,text),public.create_conversation(uuid,text,uuid,uuid),public.search_conversations(text,uuid,text,integer),public.usage_summary(),public.request_stop(uuid) to authenticated;
grant execute on all functions in schema public to service_role;
