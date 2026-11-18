-- Финал «Храма испытаний»: фиксированная команда, индивидуальные звёзды и общий переход.
-- Это дополнение к 202611180001_temple_quest.sql; существующие комнаты не удаляются.

alter table public.temple_quest_states
  add column if not exists team jsonb not null default '[]'::jsonb,
  add column if not exists stars jsonb not null default '{}'::jsonb,
  add column if not exists phase text not null default 'collecting'
    check (phase in ('collecting', 'final_started', 'hint_ready', 'transitioned')),
  add column if not exists final_started_at timestamptz;

create or replace function public.temple_quest_action(
  p_room_code text,
  p_action text,
  p_plate_active boolean default null,
  p_checkpoint integer default null,
  p_star_index integer default null,
  p_team jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room text := upper(trim(p_room_code));
  v_user text := auth.uid()::text;
  v_state public.temple_quest_states%rowtype;
  v_player jsonb;
  v_team_count integer;
  v_valid_team boolean;
  v_all_active boolean;
  v_all_stars boolean;
  v_result text := 'ignored';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_room !~ '^[A-Z0-9]{6}$' then raise exception 'Invalid room code'; end if;
  if p_action not in ('sync', 'checkpoint', 'plate', 'star', 'reveal_hint', 'transition') then
    raise exception 'Unknown action';
  end if;

  insert into public.temple_quest_states (room_code) values (v_room)
  on conflict (room_code) do nothing;
  select * into v_state from public.temple_quest_states where room_code = v_room for update;

  -- Состав не меняется из-за кратковременного Presence disconnect. Первый вошедший
  -- передаёт уже известный клиенту список комнаты; в нём обязательно есть он сам.
  if jsonb_array_length(v_state.team) = 0 then
    if jsonb_typeof(p_team) = 'array' then
      select count(*), coalesce(bool_and(
        jsonb_typeof(member.value) = 'object'
        and member.value ? 'id' and member.value ? 'name' and member.value ? 'color'
        and length(coalesce(member.value ->> 'id', '')) > 0
        and jsonb_typeof(member.value -> 'color') = 'number'
      ), false)
      into v_team_count, v_valid_team
      from jsonb_array_elements(p_team) as member(value);
      if v_team_count between 1 and 4 and v_valid_team
        and exists (select 1 from jsonb_array_elements(p_team) as member(value) where member.value ->> 'id' = v_user)
      then
        v_state.team := p_team;
      end if;
    end if;
    if jsonb_array_length(v_state.team) = 0 then
      v_state.team := jsonb_build_array(jsonb_build_object('id', v_user, 'name', 'Игрок', 'color', 16766720));
    end if;
  end if;

  if not exists (select 1 from jsonb_array_elements(v_state.team) as member(value) where member.value ->> 'id' = v_user) then
    raise exception 'Player is not part of this temple team';
  end if;

  v_player := coalesce(v_state.players -> v_user, '{"checkpoint": -1, "plateActive": false}'::jsonb);
  v_player := jsonb_set(v_player, '{lastSeen}', to_jsonb(now()::text), true);

  if p_action = 'checkpoint' then
    if p_checkpoint not in (0, 1, 2, 3) then raise exception 'Invalid checkpoint'; end if;
    if coalesce((v_player ->> 'checkpoint')::integer, -1) < p_checkpoint then
      v_player := jsonb_set(v_player, '{checkpoint}', to_jsonb(p_checkpoint), true);
    end if;
    v_result := 'checkpoint_saved';
  elsif p_action = 'plate' then
    if p_plate_active is null then raise exception 'Plate state is required'; end if;
    if v_state.phase <> 'collecting' then p_plate_active := false; end if;
    v_player := jsonb_set(v_player, '{plateActive}', to_jsonb(p_plate_active), true);
    v_result := 'plate_updated';
  elsif p_action = 'star' then
    if v_state.phase <> 'collecting' then
      v_result := 'ignored';
    elsif p_star_index not in (0, 1, 2) then
      raise exception 'Invalid star index';
    elsif coalesce(v_state.stars -> v_user, '[]'::jsonb) @> jsonb_build_array(p_star_index) then
      v_result := 'ignored';
    else
      v_state.stars := jsonb_set(
        v_state.stars,
        array[v_user],
        coalesce(v_state.stars -> v_user, '[]'::jsonb) || jsonb_build_array(p_star_index),
        true
      );
      v_result := 'star_collected';
    end if;
  elsif p_action = 'reveal_hint' then
    if v_state.phase = 'final_started' then
      v_state.phase := 'hint_ready';
      v_state.door_open := true;
      v_result := 'hint_ready';
    end if;
  elsif p_action = 'transition' then
    if v_state.phase = 'hint_ready' and v_state.door_open then
      v_state.phase := 'transitioned';
      v_result := 'transitioned';
    end if;
  else
    v_result := 'synced';
  end if;

  v_state.players := jsonb_set(v_state.players, array[v_user], v_player, true);
  -- Отключившиеся участники не удерживают плиту.
  select coalesce(jsonb_object_agg(key,
    case when coalesce((value ->> 'lastSeen')::timestamptz, '-infinity'::timestamptz) <= now() - interval '25 seconds'
      then jsonb_set(value, '{plateActive}', 'false'::jsonb, true)
      else value end
  ), '{}'::jsonb) into v_state.players
  from jsonb_each(v_state.players);

  select coalesce(bool_and(
    jsonb_array_length(coalesce(v_state.stars -> (member.value ->> 'id'), '[]'::jsonb)) >= 3
  ), false) into v_all_stars
  from jsonb_array_elements(v_state.team) as member(value);

  select coalesce(bool_and(
    coalesce((v_state.players -> (member.value ->> 'id') ->> 'plateActive')::boolean, false)
    and coalesce((v_state.players -> (member.value ->> 'id') ->> 'lastSeen')::timestamptz, '-infinity'::timestamptz) > now() - interval '25 seconds'
  ), false) into v_all_active
  from jsonb_array_elements(v_state.team) as member(value);

  if v_state.phase = 'collecting' and v_all_stars and v_all_active then
    v_state.phase := 'final_started';
    v_state.final_started_at := now();
    v_result := 'final_started';
  end if;

  v_state.revision := v_state.revision + 1;
  update public.temple_quest_states
    set revision = v_state.revision,
        door_open = v_state.door_open,
        players = v_state.players,
        team = v_state.team,
        stars = v_state.stars,
        phase = v_state.phase,
        final_started_at = v_state.final_started_at,
        updated_at = now()
    where room_code = v_room
    returning * into v_state;

  return jsonb_build_object(
    'result', v_result,
    'state', jsonb_build_object(
      'revision', v_state.revision,
      'doorOpen', v_state.door_open,
      'players', v_state.players,
      'team', v_state.team,
      'stars', v_state.stars,
      'phase', v_state.phase
    )
  );
end;
$$;

revoke all on function public.temple_quest_action(text, text, boolean, integer, integer, jsonb) from public;
grant execute on function public.temple_quest_action(text, text, boolean, integer, integer, jsonb) to authenticated;
