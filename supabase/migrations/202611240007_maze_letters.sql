-- Keep completed runs and checkpoints. New runs unlock the castle after the letter puzzle and a real-world code.
alter table public.maze_quest_states
  add column if not exists letter_owners jsonb not null default '{}'::jsonb;

create table if not exists public.maze_gate_settings (
  singleton boolean primary key default true check (singleton),
  entry_code text not null check (char_length(trim(entry_code)) between 1 and 80)
);
alter table public.maze_gate_settings enable row level security;
revoke all on public.maze_gate_settings from public, anon, authenticated;

create or replace function public.maze_quest_puzzle_action(
  p_room_code text,
  p_action text,
  p_index integer default null,
  p_team jsonb default null,
  p_answer text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_room text := upper(trim(p_room_code));
  v_uid text := auth.uid()::text;
  v_state public.maze_quest_states%rowtype;
  v_team jsonb;
  v_players jsonb;
  v_player jsonb;
  v_letters jsonb;
  v_completed boolean;
  v_assembly_ready boolean;
  v_roster_size integer;
  v_slot integer;
  v_limit integer;
  v_owned integer;
  v_expected_code text;
  v_result text := 'ignored';
  v_letter_count constant integer := 14;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_room is null or v_room !~ '^[A-Z0-9]{6}$'
     or p_action is null or p_action not in ('sync', 'checkpoint', 'collect', 'arrive', 'solve', 'code') then
    raise exception 'Invalid request';
  end if;
  if (p_action = 'checkpoint' and (p_index is null or p_index not between 0 and 2))
     or (p_action = 'collect' and (p_index is null or p_index not between 0 and v_letter_count - 1)) then
    raise exception 'Invalid index';
  end if;

  insert into public.maze_quest_states (room_code) values (v_room) on conflict do nothing;
  select * into strict v_state from public.maze_quest_states where room_code = v_room for update;
  v_letters := v_state.letter_owners;
  v_completed := v_state.completed;

  -- Save one roster for the run. Direct test rooms can add players before the first pickup.
  v_team := v_state.team;
  if not v_completed and v_letters = '{}'::jsonb then
    select jsonb_agg(member.value ->> 'id' order by member.ordinality)
      into v_team
      from public.temple_quest_states t
      cross join lateral jsonb_array_elements(t.team) with ordinality as member(value, ordinality)
      where t.room_code = v_room and t.phase = 'transitioned';
    if v_team is null then
      v_team := v_state.team;
      if p_action = 'sync' then
        if jsonb_typeof(p_team) is distinct from 'array' then p_team := '[]'::jsonb; end if;
        if jsonb_array_length(p_team) > 4 then raise exception 'Maze team is full'; end if;
        select coalesce(jsonb_agg(id order by id), '[]'::jsonb) into v_team
          from (
            select distinct id from jsonb_array_elements_text(v_team || p_team || jsonb_build_array(v_uid)) as members(id)
            where id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
          ) as roster;
        if jsonb_array_length(v_team) > 4 then raise exception 'Maze team is full'; end if;
      end if;
    end if;
  end if;

  if not v_team ? v_uid then raise exception 'Not in team'; end if;
  v_player := coalesce(v_state.players -> v_uid, '{"checkpoint":0,"arrived":false,"solved":false}'::jsonb);
  v_roster_size := jsonb_array_length(v_team);
  select ordinal - 1 into strict v_slot
    from jsonb_array_elements_text(v_team) with ordinality as member(id, ordinal) where id = v_uid;
  v_limit := v_letter_count / v_roster_size + case when v_slot < v_letter_count % v_roster_size then 1 else 0 end;
  select count(*) into v_owned from jsonb_each_text(v_letters) where value = v_uid;

  if p_action = 'sync' then
    v_result := 'synced';
  elsif v_completed then
    v_result := 'completed';
  elsif p_action = 'checkpoint' then
    v_player := jsonb_set(v_player, '{checkpoint}', to_jsonb(greatest((v_player ->> 'checkpoint')::integer, p_index)));
    v_result := 'checkpoint_saved';
  elsif p_action = 'collect' then
    if v_owned < v_limit and not v_letters ? p_index::text then
      v_letters := jsonb_set(v_letters, array[p_index::text], to_jsonb(v_uid));
      -- Historic in-progress players may have reached the gate before letters existed.
      v_player := jsonb_set(v_player, '{arrived}', 'false'::jsonb);
      v_result := 'collected';
    end if;
  elsif p_action = 'arrive' then
    if v_owned = v_limit then
      v_player := jsonb_set(v_player, '{arrived}', 'true'::jsonb);
      v_result := 'arrived';
    end if;
  else
    v_assembly_ready := (select count(*) from jsonb_object_keys(v_letters)) = v_letter_count
      and not exists (
        select 1 from jsonb_array_elements_text(v_team) as members(id)
        where not coalesce((v_state.players -> id ->> 'arrived')::boolean, false)
      );
    if v_assembly_ready and p_action = 'solve' then
      if upper(trim(p_answer)) is distinct from 'КОДПОДПОДУШКОЙ' then
        v_result := 'wrong';
      else
        v_player := jsonb_set(v_player, '{solved}', 'true'::jsonb);
        v_result := 'solved';
      end if;
    elsif v_assembly_ready and p_action = 'code' and not exists (
      select 1 from jsonb_array_elements_text(v_team) as members(id)
      where not coalesce((v_state.players -> id ->> 'solved')::boolean, false)
    ) then
      select entry_code into v_expected_code from public.maze_gate_settings where singleton;
      if v_expected_code is null then
        v_result := 'code_pending';
      elsif upper(trim(p_answer)) is distinct from upper(trim(v_expected_code)) then
        v_result := 'wrong';
      else
        v_completed := true;
        v_result := 'completed';
      end if;
    end if;
  end if;

  v_players := jsonb_set(v_state.players, array[v_uid], v_player);
  if (v_team, v_players, v_letters, v_completed) is distinct from
     (v_state.team, v_state.players, v_state.letter_owners, v_state.completed) then
    update public.maze_quest_states
    set revision = revision + 1, team = v_team, players = v_players, letter_owners = v_letters,
      completed = v_completed, updated_at = now()
    where room_code = v_room returning * into v_state;
  end if;
  return jsonb_build_object('result', v_result, 'state', jsonb_build_object(
    'revision', v_state.revision, 'team', v_state.team, 'players', v_state.players,
    'letter_owners', v_state.letter_owners, 'completed', v_state.completed
  ));
end;
$$;

revoke all on function public.maze_quest_puzzle_action(text, text, integer, jsonb, text) from public, anon;
grant execute on function public.maze_quest_puzzle_action(text, text, integer, jsonb, text) to authenticated;

-- An older client can still read and save progress, but its arrival cannot bypass the new code.
create or replace function public.maze_quest_action(
  p_room_code text,
  p_action text,
  p_checkpoint integer default null,
  p_team jsonb default null
) returns jsonb
language sql security invoker
set search_path = public
as $$
  select public.maze_quest_puzzle_action(p_room_code, p_action, p_checkpoint, p_team);
$$;
