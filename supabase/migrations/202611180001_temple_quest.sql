-- Общий финальный зал «Храма испытаний».
-- Состояние двери хранится на сервере; игрок может менять только собственную плиту.

create table if not exists public.temple_quest_states (
  room_code text primary key check (room_code ~ '^[A-Z0-9]{6}$'),
  revision bigint not null default 0,
  door_open boolean not null default false,
  players jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.temple_quest_states enable row level security;
create policy "authenticated users can read temple quest state"
  on public.temple_quest_states for select to authenticated using (true);

alter table public.temple_quest_states replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.temple_quest_states;
exception when duplicate_object then null;
end $$;

create or replace function public.temple_quest_action(
  p_room_code text,
  p_action text,
  p_plate_active boolean default null,
  p_checkpoint integer default null
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
  v_active_count integer;
  v_all_active boolean;
  v_result text := 'ignored';
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_room !~ '^[A-Z0-9]{6}$' then raise exception 'Invalid room code'; end if;
  if p_action not in ('sync', 'checkpoint', 'plate') then raise exception 'Unknown action'; end if;

  insert into public.temple_quest_states (room_code) values (v_room)
  on conflict (room_code) do nothing;
  select * into v_state from public.temple_quest_states where room_code = v_room for update;

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
    v_player := jsonb_set(v_player, '{plateActive}', to_jsonb(p_plate_active), true);
    v_result := 'plate_updated';
  else
    v_result := 'synced';
  end if;

  v_state.players := jsonb_set(v_state.players, array[v_user], v_player, true);
  -- Отключившийся игрок не удерживает плиту: heartbeat живых клиентов очищает её.
  select coalesce(jsonb_object_agg(key,
    case when coalesce((value ->> 'lastSeen')::timestamptz, '-infinity'::timestamptz) <= now() - interval '25 seconds'
      then jsonb_set(value, '{plateActive}', 'false'::jsonb, true)
      else value end
  ), '{}'::jsonb) into v_state.players
  from jsonb_each(v_state.players);
  select count(*), coalesce(bool_and(coalesce((value ->> 'plateActive')::boolean, false)), false)
    into v_active_count, v_all_active
    from jsonb_each(v_state.players)
    where coalesce((value ->> 'lastSeen')::timestamptz, '-infinity'::timestamptz) > now() - interval '25 seconds';

  if not v_state.door_open and v_active_count > 0 and v_all_active then
    v_state.door_open := true;
    v_result := 'opened';
  end if;
  v_state.revision := v_state.revision + 1;
  update public.temple_quest_states
    set revision = v_state.revision, door_open = v_state.door_open, players = v_state.players, updated_at = now()
    where room_code = v_room returning * into v_state;

  return jsonb_build_object(
    'result', v_result,
    'state', jsonb_build_object('revision', v_state.revision, 'doorOpen', v_state.door_open, 'players', v_state.players)
  );
end;
$$;

revoke all on function public.temple_quest_action(text, text, boolean, integer) from public;
grant execute on function public.temple_quest_action(text, text, boolean, integer) to authenticated;
