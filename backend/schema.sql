-- Evermere v1 · run once in your Supabase SQL editor.
-- Only the authenticated Edge Function uses service_role to mutate state.
create table if not exists public.game_players (
 id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null, revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
create table if not exists public.game_nodes (
 id text primary key, cx integer not null, cz integer not null,
 actor uuid not null references public.game_players(id), depleted_at timestamptz not null default now()
);
create index if not exists game_nodes_chunk on public.game_nodes(cx,cz);
create table if not exists public.game_memories (
 id bigint generated always as identity primary key, npc text not null,
 player_id uuid not null references public.game_players(id), player_name text not null,
 message text not null check (length(message) between 1 and 800), response text not null,
 created_at timestamptz not null default now()
);
create index if not exists game_memories_npc_time on public.game_memories(npc,created_at desc);
create table if not exists public.game_events (
 id bigint generated always as identity primary key, actor uuid not null references public.game_players(id),
 type text not null, summary text not null, data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists game_events_actor_time on public.game_events(actor,created_at desc);
alter table public.game_players enable row level security;
alter table public.game_nodes enable row level security;
alter table public.game_memories enable row level security;
alter table public.game_events enable row level security;
grant all on public.game_players,public.game_nodes,public.game_memories,public.game_events to service_role;
grant usage,select on sequence public.game_memories_id_seq,public.game_events_id_seq to service_role;
-- No client write policies. Never give browsers the service_role key.
revoke all on public.game_players,public.game_nodes,public.game_memories,public.game_events from anon,authenticated;

create or replace function public.apply_game_action(actor_id uuid, expected_revision bigint, next_state jsonb, action_type text, action_summary text, extra jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_rev bigint;
begin
 select revision into current_rev from game_players where id=actor_id for update;
 if not found then raise exception 'Traveler not found'; end if;
 if current_rev<>expected_revision then raise exception 'Your traveler changed in another session. Reload and try again.'; end if;
 if (select count(*) from game_events where actor=actor_id and created_at>now()-interval '1 minute')>90 then raise exception 'Too many actions. Wait a moment.'; end if;
 if action_type='talk' and (select count(*) from game_events where actor=actor_id and type='talk' and created_at>now()-interval '1 minute')>=20 then raise exception 'Give your conversation a moment.'; end if;
 if action_type='gather' then
  insert into game_nodes(id,cx,cz,actor) values(extra->>'resource',(split_part(extra->>'resource',':',2))::integer,(split_part(extra->>'resource',':',3))::integer,actor_id);
 end if;
 if action_type='talk' then
  insert into game_memories(npc,player_id,player_name,message,response) values(extra->>'npc',actor_id,next_state->>'name',extra->>'message',extra->>'response');
 end if;
 update game_players set state=next_state,revision=current_rev+1,updated_at=now() where id=actor_id;
 insert into game_events(actor,type,summary,data) values(actor_id,action_type,action_summary,extra);
 return next_state;
exception when unique_violation then raise exception 'Someone has already gathered this resource.';
end;
$$;
revoke all on function public.apply_game_action(uuid,bigint,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_game_action(uuid,bigint,jsonb,text,text,jsonb) to service_role;

-- Expansion v2: player homes and dungeon resource spaces. Safe for existing saves.
alter table public.game_nodes add column if not exists space text not null default 'overworld';
create index if not exists game_nodes_space on public.game_nodes(space);
create table if not exists public.game_homes (
 owner uuid primary key references public.game_players(id), village text not null,
 plot integer not null, state jsonb, unique(village,plot)
);
alter table public.game_homes enable row level security;
revoke all on public.game_homes from anon,authenticated;
grant all on public.game_homes to service_role;
create or replace function public.provision_game_player(actor_id uuid,initial_state jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p jsonb;v text;slot integer;
begin
 insert into game_players(id,state,revision) values(actor_id,initial_state,0) on conflict(id) do nothing;
 select state into p from game_players where id=actor_id for update;
 v=p->>'home';
 select plot into slot from game_homes where owner=actor_id;
 if not found then
  perform pg_advisory_xact_lock(hashtext(v));
  select coalesce(max(plot),-1)+1 into slot from game_homes where village=v;
  insert into game_homes(owner,village,plot) values(actor_id,v,slot);
 end if;
 return jsonb_build_object('player',p,'plot',slot);
end;
$$;
revoke all on function public.provision_game_player(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.provision_game_player(uuid,jsonb) to service_role;

create or replace function public.apply_game_action(actor_id uuid, expected_revision bigint, next_state jsonb, action_type text, action_summary text, extra jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_rev bigint;
begin
 select revision into current_rev from game_players where id=actor_id for update;
 if not found then raise exception 'Traveler not found';end if;
 if current_rev<>expected_revision then raise exception 'Your traveler changed in another session. Reload and try again.';end if;
 if (select count(*) from game_events where actor=actor_id and created_at>now()-interval '1 minute')>90 then raise exception 'Too many actions. Wait a moment.';end if;
 if action_type='talk' and (select count(*) from game_events where actor=actor_id and type='talk' and created_at>now()-interval '1 minute')>=20 then raise exception 'Give your conversation a moment.';end if;
 if action_type='gather' then
  insert into game_nodes(id,cx,cz,actor,space) values(extra->>'resource',(split_part(extra->>'resource',':',2))::integer,(split_part(extra->>'resource',':',3))::integer,actor_id,coalesce(extra->>'space','overworld'));
 end if;
 if action_type='talk' then
  insert into game_memories(npc,player_id,player_name,message,response) values(extra->>'npc',actor_id,next_state->>'name',extra->>'message',extra->>'response');
 end if;
 update game_players set state=next_state,revision=current_rev+1,updated_at=now() where id=actor_id;
 update game_homes set state=next_state->'house' where owner=actor_id;
 insert into game_events(actor,type,summary,data) values(actor_id,action_type,action_summary,extra);
 return next_state;
exception when unique_violation then raise exception 'Someone has already gathered this resource.';
end;
$$;
revoke all on function public.apply_game_action(uuid,bigint,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_game_action(uuid,bigint,jsonb,text,text,jsonb) to service_role;
