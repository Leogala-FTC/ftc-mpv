create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.profiles p where p.id = p_uid and p.role = 'admin');
$$;

create or replace function public.is_merchant_staff(p_uid uuid, p_merchant uuid)
returns boolean
language sql
stable
as $$
  select exists(select 1 from public.merchant_staff ms where ms.user_id = p_uid and ms.merchant_id = p_merchant)
  or public.is_admin(p_uid);
$$;

alter table public.profiles enable row level security;
alter table public.merchants enable row level security;
alter table public.merchant_staff enable row level security;
alter table public.user_wallets enable row level security;
alter table public.merchant_wallets enable row level security;
alter table public.treasury_wallet enable row level security;
alter table public.token_transactions enable row level security;
alter table public.payment_sessions enable row level security;
alter table public.receipts enable row level security;
alter table public.merchant_pricing enable row level security;
alter table public.topup_packs enable row level security;
alter table public.app_settings enable row level security;
alter table public.clearing_requests enable row level security;

create policy profiles_select on public.profiles for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy profiles_insert_self on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_admin on public.profiles for update using (public.is_admin(auth.uid()));

create policy merchants_select on public.merchants for select using (public.is_admin(auth.uid()) or exists (select 1 from public.merchant_staff ms where ms.merchant_id = id and ms.user_id = auth.uid()));
create policy merchant_wallets_select on public.merchant_wallets for select using (public.is_merchant_staff(auth.uid(), merchant_id));
create policy merchant_pricing_select on public.merchant_pricing for select using (public.is_merchant_staff(auth.uid(), merchant_id));
create policy merchant_staff_select on public.merchant_staff for select using (public.is_admin(auth.uid()) or user_id = auth.uid() or exists (select 1 from public.merchant_staff ms2 where ms2.merchant_id = merchant_id and ms2.user_id = auth.uid()));

create policy user_wallets_select on public.user_wallets for select using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy user_wallets_insert_self on public.user_wallets for insert with check (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy tx_select on public.token_transactions for select using (
  public.is_admin(auth.uid())
  or user_id = auth.uid()
  or exists (select 1 from public.merchant_staff ms where ms.merchant_id = token_transactions.merchant_id and ms.user_id = auth.uid())
);

create policy ps_select on public.payment_sessions for select using (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or exists (select 1 from public.merchant_staff ms where ms.merchant_id = payment_sessions.merchant_id and ms.user_id = auth.uid())
);

create policy receipts_select on public.receipts for select using (
  public.is_admin(auth.uid())
  or user_id = auth.uid()
  or exists (select 1 from public.merchant_staff ms where ms.merchant_id = receipts.merchant_id and ms.user_id = auth.uid())
);

create policy topup_packs_read on public.topup_packs for select using (auth.role() = 'authenticated');
create policy topup_packs_write_admin on public.topup_packs for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy app_settings_read on public.app_settings for select using (auth.role() = 'authenticated');
create policy app_settings_write_admin on public.app_settings for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy treasury_select_admin on public.treasury_wallet for select using (public.is_admin(auth.uid()));

create policy clearing_select on public.clearing_requests for select using (
  public.is_admin(auth.uid())
  or exists (select 1 from public.merchant_staff ms where ms.merchant_id = clearing_requests.merchant_id and ms.user_id = auth.uid())
);

create or replace function public.create_payment_session(p_merchant_id uuid, p_amount_eur numeric, p_created_by uuid)
returns public.payment_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tokens numeric;
  v_ttl int;
  v_row public.payment_sessions;
begin
  select cost_tokens into v_tokens from public.merchant_pricing where merchant_id = p_merchant_id and amount_eur = p_amount_eur;
  if v_tokens is null then
    raise exception 'Fuori FTC';
  end if;

  select coalesce(session_ttl_seconds, 90) into v_ttl from public.app_settings where id = 1;

  insert into public.payment_sessions (merchant_id, amount_eur, amount_tokens, status, expires_at, created_by)
  values (p_merchant_id, p_amount_eur, v_tokens, 'pending', now() + make_interval(secs => v_ttl), p_created_by)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.confirm_payment(p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.payment_sessions;
  v_balance numeric;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_session from public.payment_sessions where id = p_session_id for update;
  if not found then raise exception 'Sessione non trovata'; end if;
  if v_session.status <> 'pending' then raise exception 'Sessione non pending'; end if;
  if v_session.expires_at < now() then
    update public.payment_sessions set status='expired' where id = p_session_id;
    raise exception 'Sessione scaduta';
  end if;

  select balance_tokens into v_balance from public.user_wallets where user_id = v_uid for update;
  if coalesce(v_balance,0) < v_session.amount_tokens then raise exception 'Saldo insufficiente'; end if;

  update public.user_wallets set balance_tokens = balance_tokens - v_session.amount_tokens, updated_at = now() where user_id = v_uid;
  update public.merchant_wallets set available_tokens = available_tokens + v_session.amount_tokens, updated_at = now() where merchant_id = v_session.merchant_id;
  insert into public.token_transactions(user_id, merchant_id, type, amount_tokens, metadata) values (v_uid, v_session.merchant_id, 'spend', v_session.amount_tokens, jsonb_build_object('session_id', v_session.id));
  update public.payment_sessions set status='paid' where id = p_session_id;
  insert into public.receipts(session_id, user_id, merchant_id, amount_eur, amount_tokens) values (v_session.id, v_uid, v_session.merchant_id, v_session.amount_eur, v_session.amount_tokens);

  return json_build_object('ok', true, 'session_id', v_session.id, 'amount_tokens', v_session.amount_tokens);
end;
$$;

create or replace function public.topup(p_user_id uuid, p_pack_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_tokens numeric;
begin
  select tokens into v_tokens from public.topup_packs where id = p_pack_id and is_active = true;
  if v_tokens is null then raise exception 'Pack non valido'; end if;

  insert into public.user_wallets(user_id, balance_tokens) values (p_user_id, v_tokens)
  on conflict (user_id) do update set balance_tokens = public.user_wallets.balance_tokens + excluded.balance_tokens, updated_at = now();

  insert into public.token_transactions(user_id, merchant_id, type, amount_tokens, metadata)
  values (p_user_id, null, 'topup', v_tokens, jsonb_build_object('pack_id', p_pack_id));
end;
$$;

create or replace function public.request_clearing(p_merchant_id uuid, p_requested_tokens numeric, p_requested_by uuid)
returns public.clearing_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate numeric;
  v_week_start date := date_trunc('week', now())::date;
  v_row public.clearing_requests;
begin
  if p_requested_tokens <= 0 then raise exception 'Token non validi'; end if;

  update public.merchant_wallets
    set available_tokens = available_tokens - p_requested_tokens,
        pending_tokens = pending_tokens + p_requested_tokens,
        updated_at = now()
  where merchant_id = p_merchant_id and available_tokens >= p_requested_tokens;

  if not found then raise exception 'Saldo disponibile insufficiente'; end if;

  select token_eur_rate_estimate into v_rate from public.app_settings where id = 1;

  insert into public.clearing_requests (merchant_id, requested_tokens, eur_estimate, week_start, status, requested_by)
  values (p_merchant_id, p_requested_tokens, round(p_requested_tokens * coalesce(v_rate,0.02),2), v_week_start, 'pending', p_requested_by)
  returning * into v_row;

  return v_row;
exception when unique_violation then
  raise exception 'Richiesta già presente per questa settimana';
end;
$$;

create or replace function public.approve_clearing(p_request_id uuid, p_admin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.clearing_requests;
begin
  select * into v_req from public.clearing_requests where id = p_request_id for update;
  if v_req.status <> 'pending' then raise exception 'Stato non valido'; end if;
  update public.merchant_wallets set pending_tokens = pending_tokens - v_req.requested_tokens, updated_at = now() where merchant_id = v_req.merchant_id;
  update public.treasury_wallet set balance_tokens = balance_tokens + v_req.requested_tokens, updated_at = now() where id = 1;
  update public.clearing_requests set status='approved', approved_by = p_admin_id, approved_at = now() where id = p_request_id;
end;
$$;

create or replace function public.reject_clearing(p_request_id uuid, p_admin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_req public.clearing_requests;
begin
  select * into v_req from public.clearing_requests where id = p_request_id for update;
  if v_req.status <> 'pending' then raise exception 'Stato non valido'; end if;
  update public.merchant_wallets set pending_tokens = pending_tokens - v_req.requested_tokens, available_tokens = available_tokens + v_req.requested_tokens, updated_at = now() where merchant_id = v_req.merchant_id;
  update public.clearing_requests set status='rejected', rejected_by = p_admin_id, rejected_at = now() where id = p_request_id;
end;
$$;

create or replace function public.mark_clearing_paid(p_request_id uuid, p_admin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.clearing_requests set status='paid', paid_by = p_admin_id, paid_at = now() where id = p_request_id and status = 'approved';
  if not found then raise exception 'Richiesta non approvata'; end if;
end;
$$;

grant execute on function public.create_payment_session(uuid,numeric,uuid) to authenticated;
grant execute on function public.confirm_payment(uuid) to authenticated;
grant execute on function public.topup(uuid,int) to authenticated;
grant execute on function public.request_clearing(uuid,numeric,uuid) to authenticated;
grant execute on function public.approve_clearing(uuid,uuid) to authenticated;
grant execute on function public.reject_clearing(uuid,uuid) to authenticated;
grant execute on function public.mark_clearing_paid(uuid,uuid) to authenticated;
