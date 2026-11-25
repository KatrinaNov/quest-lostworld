create table if not exists public.castle_memory_attempts (
  room_code text not null references public.castle_quest_states(room_code) on delete cascade,
  player_id uuid not null,
  stage integer not null check (stage between 0 and 2),
  pattern text not null check (
    pattern ~ '^[1-9]+$' and char_length(pattern) = 3 + stage * 2
  ),
  primary key (room_code, player_id)
);

alter table public.castle_memory_attempts enable row level security;
revoke all on public.castle_memory_attempts from public, anon, authenticated;

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
  v_uid uuid := auth.uid();
  v_state public.castle_quest_states%rowtype;
  v_answer text := upper(trim(p_answer));
  v_bit integer;
  v_result text := 'synced';
  v_open boolean := false;
  v_stage integer;
  v_pattern text;
  v_retry boolean := false;
  v_memory jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_room is null or v_room !~ '^[A-Z0-9]{6}$' or p_seal not between 0 and 3 then
    raise exception 'Invalid castle request';
  end if;

  if not exists (select 1 from public.maze_quest_states maze
    where maze.room_code = v_room and maze.completed and maze.team ? v_uid::text) then
    raise exception 'The team must complete the labyrinth';
  end if;

  insert into public.castle_quest_states (room_code) values (v_room) on conflict do nothing;
  select * into strict v_state from public.castle_quest_states where room_code = v_room for update;

  if p_seal is not null then
    v_bit := 1 << p_seal;
    if (v_state.opened_mask & v_bit) <> 0 then
      v_result := 'already_open';
    elsif p_seal = 2 then
      select stage, pattern into v_stage, v_pattern
        from public.castle_memory_attempts where room_code = v_room and player_id = v_uid;
      v_stage := coalesce(v_stage, 0);

      -- Ignore a repeated submission for a round the player has already passed.
      if v_pattern is not null and v_answer ~ '^[0-2]:[1-9]{1,7}$' and left(v_answer, 1) = v_stage::text then
        if substring(v_answer from 3) <> v_pattern then
          v_retry := true;
        elsif v_stage = 2 then
          v_open := true;
        else
          v_stage := v_stage + 1;
          v_pattern := null;
        end if;
      end if;

      if not v_open then
        if v_pattern is null then
          select string_agg(tile::text, '' order by draw) into v_pattern
          from (
            select tile, random() as draw from generate_series(1, 9) as tiles(tile)
            order by draw limit (3 + v_stage * 2)
          ) sample;
          insert into public.castle_memory_attempts (room_code, player_id, stage, pattern)
            values (v_room, v_uid, v_stage, v_pattern)
            on conflict (room_code, player_id) do update set stage = excluded.stage, pattern = excluded.pattern;
        end if;
        v_result := 'memory';
        v_memory := jsonb_build_object('stage', v_stage, 'pattern', v_pattern, 'retry', v_retry);
      end if;
    else
      v_open := v_answer is not distinct from case p_seal
        when 0 then 'CREEPER,BOW,TORCH,AXE,PICKAXE,SWORD,POTION'
        when 1 then '108'
        when 3 then 'КРЫЛО'
      end;
      v_result := 'wrong';
    end if;

    if v_open then
      update public.castle_quest_states set opened_mask = opened_mask | v_bit, revision = revision + 1
        where room_code = v_room returning * into v_state;
      v_result := case when v_state.opened_mask = 15 then 'completed' else 'opened' end;
    end if;
  end if;

  return jsonb_build_object('result', v_result, 'state', jsonb_build_object(
    'revision', v_state.revision, 'openedMask', v_state.opened_mask
  ), 'memory', v_memory);
end;
$$;

revoke all on function public.castle_quest_action(text, integer, text) from public, anon;
grant execute on function public.castle_quest_action(text, integer, text) to authenticated;
