-- Минимальное серверное состояние квеста второй локации.
-- Выполняется один раз в Supabase SQL Editor или через Supabase CLI.

create table if not exists public.jungle_quest_states (
  room_code text primary key check (room_code ~ '^[A-Z0-9]{6}$'),
  revision bigint not null default 0,
  symbols jsonb not null default '{"leaf": false, "water": false, "stone": false}'::jsonb,
  phase text not null default 'exploring' check (phase in ('exploring', 'message_ready', 'secret_word', 'temple_open')),
  message_acknowledged boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.jungle_quest_states enable row level security;
create policy "authenticated users can read jungle quest state"
  on public.jungle_quest_states for select to authenticated using (true);

alter table public.jungle_quest_states replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.jungle_quest_states;
exception when duplicate_object then null;
end $$;

create or replace function public.jungle_quest_action(
  p_room_code text,
  p_action text,
  p_symbol text default null,
  p_secret text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room text := upper(trim(p_room_code));
  v_state public.jungle_quest_states%rowtype;
  v_result text := 'ignored';
  v_changed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_room !~ '^[A-Z0-9]{6}$' then raise exception 'Invalid room code'; end if;

  insert into public.jungle_quest_states (room_code) values (v_room)
  on conflict (room_code) do nothing;
  select * into v_state from public.jungle_quest_states where room_code = v_room for update;

  if p_action = 'claim_symbol' then
    if p_symbol not in ('leaf', 'water', 'stone') or v_state.phase <> 'exploring' then
      v_result := 'unavailable';
    elsif coalesce((v_state.symbols ->> p_symbol)::boolean, false) then
      v_result := 'already';
    else
      v_state.symbols := jsonb_set(v_state.symbols, array[p_symbol], 'true'::jsonb, true);
      v_state.revision := v_state.revision + 1;
      v_changed := true;
      v_result := 'claimed';
      if (v_state.symbols ->> 'leaf')::boolean and (v_state.symbols ->> 'water')::boolean and (v_state.symbols ->> 'stone')::boolean then
        v_state.phase := 'message_ready';
      end if;
    end if;
  elsif p_action = 'ack_message' then
    if v_state.phase = 'message_ready' then
      v_state.phase := 'secret_word';
      v_state.message_acknowledged := true;
      v_state.revision := v_state.revision + 1;
      v_changed := true;
      v_result := 'acknowledged';
    end if;
  elsif p_action = 'submit_secret' then
    if v_state.phase <> 'secret_word' then
      v_result := 'ignored';
    elsif upper(trim(coalesce(p_secret, ''))) <> 'ХРАМ' then
      v_result := 'wrong';
    else
      v_state.phase := 'temple_open';
      v_state.revision := v_state.revision + 1;
      v_changed := true;
      v_result := 'opened';
    end if;
  elsif p_action = 'sync' then
    v_result := 'synced';
  else
    raise exception 'Unknown action';
  end if;

  if v_changed then
    update public.jungle_quest_states
      set revision = v_state.revision, symbols = v_state.symbols, phase = v_state.phase,
          message_acknowledged = v_state.message_acknowledged, updated_at = now()
      where room_code = v_room
      returning * into v_state;
  end if;

  return jsonb_build_object(
    'result', v_result,
    'state', jsonb_build_object(
      'revision', v_state.revision,
      'symbols', v_state.symbols,
      'phase', v_state.phase,
      'messageAcknowledged', v_state.message_acknowledged
    )
  );
end;
$$;

revoke all on function public.jungle_quest_action(text, text, text, text) from public;
grant execute on function public.jungle_quest_action(text, text, text, text) to authenticated;
