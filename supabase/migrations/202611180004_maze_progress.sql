-- Preserve saved checkpoints and arrival. A regular run uses the finalized temple roster.
create or replace function public.maze_quest_action(
  p_room_code text,
  p_action text,
  p_checkpoint integer default null,
  p_team jsonb default null
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
  v_completed boolean;
  v_result text := 'ignored';
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_room is null or v_room !~ '^[A-Z0-9]{6}$'
     or p_action is null or p_action not in ('sync', 'checkpoint', 'arrive') then
    raise exception 'Invalid request';
  end if;
  if p_action = 'checkpoint' and (p_checkpoint is null or p_checkpoint not in (0, 1, 2)) then
    raise exception 'Invalid checkpoint';
  end if;

  insert into public.maze_quest_states (room_code) values (v_room) on conflict do nothing;
  select * into strict v_state from public.maze_quest_states where room_code = v_room for update;

  select jsonb_agg(member.value ->> 'id' order by member.ordinality)
  into v_team
  from public.temple_quest_states t
  cross join lateral jsonb_array_elements(t.team) with ordinality as member(value, ordinality)
  where t.room_code = v_room and t.phase = 'transitioned';

  if v_team is null then
    v_team := v_state.team;
    -- A direct test room starts when its creator arrives. Admit later test participants
    -- while the maze is in progress without removing anyone who already joined.
    if p_action = 'sync' and not v_state.completed then
      select coalesce(jsonb_agg(id order by id), '[]'::jsonb) into v_team
      from (
        select distinct id
        from jsonb_array_elements_text(v_state.team || coalesce(
          case when jsonb_typeof(p_team) = 'array' and jsonb_array_length(p_team) <= 4 then p_team end,
          '[]'::jsonb
        ) || jsonb_build_array(v_uid)) as members(id)
        where id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      ) as roster;
      if jsonb_array_length(v_team) > 4 then raise exception 'Maze team is full'; end if;
    end if;
  end if;

  if not v_team ? v_uid then raise exception 'Not in team'; end if;
  v_player := coalesce(v_state.players -> v_uid, '{"checkpoint":0,"arrived":false}'::jsonb);
  if p_action = 'checkpoint' then
    v_player := jsonb_set(v_player, '{checkpoint}', to_jsonb(greatest((v_player ->> 'checkpoint')::integer, p_checkpoint)), true);
    v_result := 'checkpoint_saved';
  elsif p_action = 'arrive' then
    v_player := jsonb_set(v_player, '{arrived}', 'true'::jsonb, true);
    v_result := 'arrived';
  else
    v_result := 'synced';
  end if;
  v_players := jsonb_set(v_state.players, array[v_uid], v_player, true);
  v_completed := v_state.completed or not exists (
    select 1 from jsonb_array_elements_text(v_team) as members(id)
    where not coalesce((v_players -> id ->> 'arrived')::boolean, false)
  );

  if v_completed and not v_state.completed then v_result := 'completed'; end if;
  if (v_team, v_players, v_completed) is distinct from (v_state.team, v_state.players, v_state.completed) then
    update public.maze_quest_states
    set revision = revision + 1, team = v_team, players = v_players, completed = v_completed, updated_at = now()
    where room_code = v_room returning * into v_state;
  end if;
  return jsonb_build_object('result', v_result, 'state', jsonb_build_object(
    'revision', v_state.revision, 'team', v_state.team, 'players', v_state.players, 'completed', v_state.completed
  ));
end;
$$;

revoke all on function public.maze_quest_action(text, text, integer, jsonb) from public;
grant execute on function public.maze_quest_action(text, text, integer, jsonb) to authenticated;
