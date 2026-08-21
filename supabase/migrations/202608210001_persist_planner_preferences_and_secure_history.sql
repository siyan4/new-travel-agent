alter table public.user_travel_preference_settings
  add column if not exists travel_interests text[] not null default '{}'::text[],
  add column if not exists planning_priorities text[] not null default '{}'::text[],
  add column if not exists sight_preferences jsonb not null default '{}'::jsonb,
  add column if not exists trip_notes text not null default '';

revoke all on table public.user_travel_preference_settings from anon, authenticated;
grant select, insert, update on table public.user_travel_preference_settings to authenticated;

drop policy if exists "users manage own travel settings" on public.user_travel_preference_settings;
drop policy if exists "users read own travel settings" on public.user_travel_preference_settings;
drop policy if exists "users insert own travel settings" on public.user_travel_preference_settings;
drop policy if exists "users update own travel settings" on public.user_travel_preference_settings;

create policy "users read own travel settings"
on public.user_travel_preference_settings for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users insert own travel settings"
on public.user_travel_preference_settings for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own travel settings"
on public.user_travel_preference_settings for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.user_travel_plan_history from anon, authenticated;
grant select, insert on table public.user_travel_plan_history to authenticated;

drop policy if exists "users manage own plan history" on public.user_travel_plan_history;
drop policy if exists "users read own plan history" on public.user_travel_plan_history;
drop policy if exists "users insert own plan history" on public.user_travel_plan_history;

create policy "users read own plan history"
on public.user_travel_plan_history for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users insert own plan history"
on public.user_travel_plan_history for insert to authenticated
with check ((select auth.uid()) = user_id);

create index if not exists user_travel_plan_history_user_created_idx
on public.user_travel_plan_history (user_id, created_at desc);
