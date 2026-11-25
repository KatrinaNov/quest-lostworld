alter table public.castle_quest_states
  add column if not exists mirror_holds jsonb not null default '{}'::jsonb;

-- Keep the existing three puzzles and their saved attempts behind the same public RPC.
do $$
begin
  if to_regprocedure('public.castle_quest_puzzle_action(text,integer,text)') is null then
    alter function public.castle_quest_action(text, integer, text) rename to castle_quest_puzzle_action;
  end if;
end;
$$;
revoke all on function public.castle_quest_puzzle_action(text, integer, text) from public, anon, authenticated;

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
  v_team jsonb;
  v_state public.castle_quest_states%rowtype;
  v_result text;
  v_answer text := upper(trim(p_answer));
  v_response jsonb;
  v_holds jsonb;
  v_previous jsonb;
  v_step integer;
  v_now bigint;
  v_since bigint;
  v_open boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_room is null or v_room !~ '^[A-Z0-9]{6}$' or p_seal not between 0 and 3 then
    raise exception 'Invalid castle request';
  end if;

  select maze.team into v_team from public.maze_quest_states maze
    where maze.room_code = v_room and maze.completed and maze.team ? v_uid;
  if v_team is null then raise exception 'The team must complete the labyrinth'; end if;

  if p_seal is distinct from 3 then
    v_response := public.castle_quest_puzzle_action(v_room, p_seal, p_answer);
    select * into strict v_state from public.castle_quest_states where room_code = v_room;
    v_now := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  else
    insert into public.castle_quest_states (room_code) values (v_room) on conflict do nothing;
    select * into strict v_state from public.castle_quest_states where room_code = v_room for update;
    v_now := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

    if (v_state.opened_mask & 8) <> 0 then
      v_result := 'already_open';
    elsif v_answer = 'RELEASE' or v_answer ~ '^[0-7]$' then
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_holds
      from jsonb_each(v_state.mirror_holds)
      where (value->>'expiresAt')::bigint > v_now;

      if v_answer = 'RELEASE' then
        v_holds := v_holds - v_uid;
      else
        v_step := v_answer::integer;
        v_previous := v_holds -> v_uid;
        v_since := case
          when v_step <> 0 then null
          when v_previous->>'step' = '0' then (v_previous->>'alignedSince')::bigint
          else v_now
        end;
        v_holds := jsonb_set(v_holds, array[v_uid], jsonb_build_object(
          'step', v_step, 'expiresAt', v_now + 2600, 'alignedSince', v_since
        ));

        -- Step 0 aims at the seal. Each member must hold for one overlapping interval.
        if v_step = 0 then
          v_open := not exists (
            select 1 from jsonb_array_elements_text(v_team) as member(id)
            where coalesce(v_holds -> id ->> 'step', '') <> '0'
              or coalesce((v_holds -> id ->> 'alignedSince')::bigint, v_now) > v_now - 650
          );
        end if;
      end if;

      v_result := 'synced';
      if v_holds is distinct from v_state.mirror_holds or v_open then
        update public.castle_quest_states
        set revision = revision + 1,
            opened_mask = case when v_open then opened_mask | 8 else opened_mask end,
            mirror_holds = case when v_open then '{}'::jsonb else v_holds end
        where room_code = v_room returning * into v_state;
      end if;
      if v_open then
        v_result := case when v_state.opened_mask = 15 then 'completed' else 'opened' end;
      end if;
    else
      v_result := 'wrong';
    end if;
    v_response := jsonb_build_object('result', v_result);
  end if;

  return v_response || jsonb_build_object('serverTime', v_now, 'state', jsonb_build_object(
    'revision', v_state.revision, 'openedMask', v_state.opened_mask,
    'mirrorTeam', v_team, 'mirrorHolds', v_state.mirror_holds
  ));
end;
$$;

revoke all on function public.castle_quest_action(text, integer, text) from public, anon;
grant execute on function public.castle_quest_action(text, integer, text) to authenticated;
