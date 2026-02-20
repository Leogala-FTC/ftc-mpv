-- FTC MVP - app logic, seed data, RLS + helper RPC

-- Seed singletons (safe to re-run)
insert into public.app_settings (id, token_eur_rate_estimate, session_ttl_seconds)
values (1, 0.02, 90)
on conflict (id) do update
set token_eur_rate_estimate = excluded.token_eur_rate_estimate,
    session_ttl_seconds = excluded.session_ttl_seconds;

insert into public.treasury_wallet (id, balance_tokens)
values (1, 0)
on conflict (id) do nothing;

insert into public.topup_packs (id, name, tokens, sort_order, is_active)
values
  (1, 'Soap Starter', 1000, 1, true),
  (2, 'Soap Plus', 2500, 2, true),
  (3, 'Soap Pro', 6000, 3, true),
  (4, 'Soap Ultra', 15000, 4, true)
on conflict (id) do update
set name = excluded.name,
    tokens = excluded.tokens,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

-- Ensure a profile + user wallet exist for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name)
  values (new.id, 'user', coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;

  insert into public.user_wallets (user_id, balance_tokens)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper: pay a session (atomic)
create or replace function public.pay_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_session public.payment_sessions%rowtype;
  v_balance numeric(18,2);
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Non sei loggato.';
  end if;

  select * into v_session
  from public.payment_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Pagamento non trovato.';
  end if;
  if v_session.status <> 'pending' then
    raise exception 'Pagamento non disponibile (stato: %).', v_session.status;
  end if;
  if v_session.expires_at <= now() then
    update public.payment_sessions set status = 'expired' where id = p_session_id;
    raise exception 'QR scaduto.';
  end if;

  select balance_tokens into v_balance
  from public.user_wallets
  where user_id = v_uid
  for update;

  if v_balance is null then
    raise exception 'Wallet utente mancante.';
  end if;
  if v_balance < v_session.amount_tokens then
    raise exception 'Token insufficienti.';
  end if;

  update public.user_wallets
  set balance_tokens = balance_tokens - v_session.amount_tokens,
      updated_at = now()
  where user_id = v_uid;

  update public.merchant_wallets
  set available_tokens = available_tokens + v_session.amount_tokens,
      updated_at = now()
  where merchant_id = v_session.merchant_id;

  update public.payment_sessions
  set status = 'paid'
  where id = p_session_id;

  insert into public.token_transactions (user_id, merchant_id, type, amount_tokens, metadata)
  values (v_uid, v_session.merchant_id, 'spend', v_session.amount_tokens, jsonb_build_object('session_id', p_session_id));

  insert into public.receipts (session_id, user_id, merchant_id, amount_eur, amount_tokens)
  values (p_session_id, v_uid, v_session.merchant_id, v_session.amount_eur, v_session.amount_tokens)
  on conflict (session_id) do nothing;
end;
$$;

-- Clearing token moves
create or replace function public.clearing_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- move available -> pending (Option A)
  update public.merchant_wallets
  set available_tokens = available_tokens - new.requested_tokens,
      pending_tokens = pending_tokens + new.requested_tokens,
      updated_at = now()
  where merchant_id = new.merchant_id
    and available_tokens >= new.requested_tokens;

  if not found then
    raise exception 'Token disponibili insufficienti.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clearing_insert on public.clearing_requests;
create trigger trg_clearing_insert
after insert on public.clearing_requests
for each row execute procedure public.clearing_on_insert();

create or replace function public.clearing_on_update_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  -- pending -> approved: pending -> treasury
  if old.status = 'pending' and new.status = 'approved' then
    update public.merchant_wallets
    set pending_tokens = pending_tokens - old.requested_tokens,
        updated_at = now()
    where merchant_id = old.merchant_id;

    update public.treasury_wallet
    set balance_tokens = balance_tokens + old.requested_tokens,
        updated_at = now()
    where id = 1;
  end if;

  -- pending -> rejected: pending -> available
  if old.status = 'pending' and new.status = 'rejected' then
    update public.merchant_wallets
    set pending_tokens = pending_tokens - old.requested_tokens,
        available_tokens = available_tokens + old.requested_tokens,
        updated_at = now()
    where merchant_id = old.merchant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_clearing_update on public.clearing_requests;
create trigger trg_clearing_update
after update of status on public.clearing_requests
for each row execute procedure public.clearing_on_update_status();

-- RLS (minimal, permissive enough for MVP)

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_wallets enable row level security;
alter table public.merchants enable row level security;
alter table public.merchant_staff enable row level security;
alter table public.merchant_wallets enable row level security;
alter table public.merchant_pricing enable row level security;
alter table public.payment_sessions enable row level security;
alter table public.receipts enable row level security;
alter table public.token_transactions enable row level security;
alter table public.clearing_requests enable row level security;
alter table public.app_settings enable row level security;
alter table public.topup_packs enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- user_wallets
drop policy if exists user_wallets_select on public.user_wallets;
create policy user_wallets_select on public.user_wallets
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- merchants
drop policy if exists merchants_select on public.merchants;
create policy merchants_select on public.merchants
for select to authenticated
using (
  public.is_admin()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = merchants.id and ms.user_id = auth.uid()
  )
);

-- merchant_staff
drop policy if exists merchant_staff_select on public.merchant_staff;
create policy merchant_staff_select on public.merchant_staff
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- merchant_wallets
drop policy if exists merchant_wallets_select on public.merchant_wallets;
create policy merchant_wallets_select on public.merchant_wallets
for select to authenticated
using (
  public.is_admin()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = merchant_wallets.merchant_id and ms.user_id = auth.uid()
  )
);

-- merchant_pricing
drop policy if exists merchant_pricing_select on public.merchant_pricing;
create policy merchant_pricing_select on public.merchant_pricing
for select to authenticated
using (
  public.is_admin()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = merchant_pricing.merchant_id and ms.user_id = auth.uid()
  )
);

-- payment_sessions
drop policy if exists payment_sessions_select on public.payment_sessions;
create policy payment_sessions_select on public.payment_sessions
for select to authenticated
using (
  public.is_admin()
  or created_by = auth.uid()
  or status = 'pending'
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = payment_sessions.merchant_id and ms.user_id = auth.uid()
  )
);

drop policy if exists payment_sessions_insert on public.payment_sessions;
create policy payment_sessions_insert on public.payment_sessions
for insert to authenticated
with check (
  exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = payment_sessions.merchant_id and ms.user_id = auth.uid()
  )
);

drop policy if exists payment_sessions_update on public.payment_sessions;
create policy payment_sessions_update on public.payment_sessions
for update to authenticated
using (
  public.is_admin()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = payment_sessions.merchant_id and ms.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = payment_sessions.merchant_id and ms.user_id = auth.uid()
  )
);

-- receipts
drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts
for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = receipts.merchant_id and ms.user_id = auth.uid()
  )
);

-- token_transactions
drop policy if exists token_tx_select on public.token_transactions;
create policy token_tx_select on public.token_transactions
for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = token_transactions.merchant_id and ms.user_id = auth.uid()
  )
);

-- clearing_requests
drop policy if exists clearing_select on public.clearing_requests;
create policy clearing_select on public.clearing_requests
for select to authenticated
using (
  public.is_admin()
  or exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = clearing_requests.merchant_id and ms.user_id = auth.uid()
  )
);

drop policy if exists clearing_insert on public.clearing_requests;
create policy clearing_insert on public.clearing_requests
for insert to authenticated
with check (
  exists(
    select 1 from public.merchant_staff ms
    where ms.merchant_id = clearing_requests.merchant_id and ms.user_id = auth.uid()
  )
);

drop policy if exists clearing_update on public.clearing_requests;
create policy clearing_update on public.clearing_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- app_settings + topup_packs readable by any logged user
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
for select to authenticated
using (true);

drop policy if exists topup_packs_select on public.topup_packs;
create policy topup_packs_select on public.topup_packs
for select to authenticated
using (true);
