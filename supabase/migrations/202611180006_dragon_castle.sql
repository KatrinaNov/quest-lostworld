create table if not exists public.castle_quest_states (
  room_code text primary key references public.maze_quest_states(room_code),
  revision bigint not null default 0,
  opened_mask integer not null default 0 check (opened_mask between 0 and 15)
);

alter table public.castle_quest_states enable row level security;
revoke all on public.castle_quest_states from anon, authenticated;
grant select on public.castle_quest_states to authenticated;

drop policy if exists "castle team reads progress" on public.castle_quest_states;
create policy "castle team reads progress" on public.castle_quest_states
  for select to authenticated using (exists (
    select 1 from public.maze_quest_states maze
    where maze.room_code = castle_quest_states.room_code and maze.completed
      and maze.team ? (select auth.uid())::text
  ));

do $$ begin
  alter publication supabase_realtime add table public.castle_quest_states;
exception when duplicate_object then null;
end $$;

create or replace function public.castle_quest_action(
  p_room_code text,
  p_seal integer default null,
  p_answer text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_room text := upper(trim(p_room_code));
  v_uid text := auth.uid()::text;
  v_state public.castle_quest_states%rowtype;
  v_expected text;
  v_bit integer;
  v_result text := 'synced';
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_room is null or v_room !~ '^[A-Z0-9]{6}$' or p_seal not between 0 and 3 then
    raise exception 'Invalid castle request';
  end if;

  if not exists (select 1 from public.maze_quest_states maze
    where maze.room_code = v_room and maze.completed and maze.team ? v_uid) then
    raise exception 'The team must complete the labyrinth';
  end if;

  insert into public.castle_quest_states (room_code) values (v_room) on conflict do nothing;
  select * into strict v_state from public.castle_quest_states where room_code = v_room for update;

  if p_seal is not null then
    v_expected := case p_seal when 0 then 'STONE,WATER,LEAF,FIRE' when 1 then '6'
      when 2 then '1,4,1' when 3 then 'КРЫЛО' end;
    v_bit := 1 << p_seal;
    if (v_state.opened_mask & v_bit) <> 0 then
      v_result := 'already_open';
    elsif upper(trim(p_answer)) is distinct from v_expected then
      v_result := 'wrong';
    else
      update public.castle_quest_states set opened_mask = opened_mask | v_bit, revision = revision + 1
        where room_code = v_room returning * into v_state;
      v_result := case when v_state.opened_mask = 15 then 'completed' else 'opened' end;
    end if;
  end if;

  return jsonb_build_object('result', v_result, 'state', jsonb_build_object(
    'revision', v_state.revision, 'openedMask', v_state.opened_mask
  ));
end;
$$;

revoke all on function public.castle_quest_action(text, integer, text) from public, anon;
grant execute on function public.castle_quest_action(text, integer, text) to authenticated;
