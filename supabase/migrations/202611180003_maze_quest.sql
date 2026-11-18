create table if not exists public.maze_quest_states (room_code text primary key check (room_code ~ '^[A-Z0-9]{6}$'), revision bigint not null default 0, team jsonb not null default '[]'::jsonb, players jsonb not null default '{}'::jsonb, completed boolean not null default false, updated_at timestamptz not null default now());
alter table public.maze_quest_states enable row level security;
create policy "authenticated users can read maze quest state" on public.maze_quest_states for select to authenticated using (true);
alter table public.maze_quest_states replica identity full;
do $$ begin alter publication supabase_realtime add table public.maze_quest_states; exception when duplicate_object then null; end $$;
create or replace function public.maze_quest_action(p_room_code text, p_action text, p_checkpoint integer default null, p_team jsonb default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare room text:=upper(trim(p_room_code)); uid text:=auth.uid()::text; st public.maze_quest_states%rowtype; pl jsonb; all_arrived boolean; result text:='ignored';
begin
 if uid is null then raise exception 'Authentication required'; end if; if room !~ '^[A-Z0-9]{6}$' or p_action not in ('sync','checkpoint','arrive') then raise exception 'Invalid request'; end if;
 insert into public.maze_quest_states(room_code) values(room) on conflict do nothing; select * into st from public.maze_quest_states where room_code=room for update;
 if jsonb_array_length(st.team)=0 then st.team:=coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(p_team,'[]'::jsonb)) as m(value) where jsonb_typeof(value)='string'),jsonb_build_array(to_jsonb(uid))); if jsonb_array_length(st.team)=0 then st.team:=jsonb_build_array(to_jsonb(uid)); end if; end if;
 if not exists(select 1 from jsonb_array_elements(st.team) as m(value) where m.value #>> '{}' = uid) then raise exception 'Not in team'; end if;
 pl:=coalesce(st.players->uid,'{"checkpoint":0,"arrived":false}'::jsonb);
 if p_action='checkpoint' then if p_checkpoint not in (0,1,2) then raise exception 'Invalid checkpoint'; end if; pl:=jsonb_set(pl,'{checkpoint}',to_jsonb(greatest(coalesce((pl->>'checkpoint')::integer,0),p_checkpoint)),true); result:='checkpoint_saved'; end if;
 if p_action='arrive' then pl:=jsonb_set(pl,'{arrived}','true'::jsonb,true); result:='arrived'; end if;
 st.players:=jsonb_set(st.players,array[uid],pl,true);
 select coalesce(bool_and(coalesce((st.players -> (m.value #>> '{}') ->> 'arrived')::boolean,false)),false) into all_arrived from jsonb_array_elements(st.team) as m(value);
 if all_arrived and not st.completed then st.completed:=true; result:='completed'; end if;
 st.revision:=st.revision+1; update public.maze_quest_states set revision=st.revision,team=st.team,players=st.players,completed=st.completed,updated_at=now() where room_code=room returning * into st;
 return jsonb_build_object('result',result,'state',jsonb_build_object('revision',st.revision,'team',st.team,'players',st.players,'completed',st.completed));
end $$;
grant execute on function public.maze_quest_action(text,text,integer,jsonb) to authenticated;
