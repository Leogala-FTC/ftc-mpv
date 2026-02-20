-- FTC MVP - onboarding helpers

-- Add flag to mark if a user has completed onboarding
alter table public.profiles
  add column if not exists onboarded boolean not null default false;

-- Create stored procedure to complete onboarding and optionally create merchant
create or replace function public.complete_onboarding(
  p_role public.app_role,
  p_name text,
  p_merchant_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mid uuid;
  v_btns numeric[] := array[5,10,15,20,25,30,35,40,45,50,60,70,80,90,100];
  v_i int;
  v_eur numeric(10,2);
  v_tokens numeric(18,2);
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_role not in ('user','merchant') then
    raise exception 'Invalid role';
  end if;

  -- always ensure user wallet exists
  insert into public.user_wallets (user_id, balance_tokens)
  values (v_uid, 0)
  on conflict (user_id) do nothing;

  -- update profile name and role, mark as onboarded
  update public.profiles
  set name = coalesce(nullif(trim(p_name),''), name),
      role = p_role,
      onboarded = true
  where id = v_uid;

  -- create merchant if needed
  if p_role = 'merchant' then
    v_mid := gen_random_uuid();

    insert into public.merchants (id, name)
    values (v_mid, coalesce(nullif(trim(p_merchant_name),''), 'Merchant'));

    insert into public.merchant_wallets (merchant_id, available_tokens, pending_tokens)
    values (v_mid, 0, 0)
    on conflict (merchant_id) do nothing;

    insert into public.merchant_staff (merchant_id, user_id, role)
    values (v_mid, v_uid, 'owner')
    on conflict (merchant_id, user_id) do nothing;

    -- default pricing: 15 buttons, using 0.02 rate estimation
    for v_i in 1..array_length(v_btns, 1) loop
      v_eur := v_btns[v_i];
      v_tokens := round(v_eur / 0.02, 2);
      insert into public.merchant_pricing (merchant_id, amount_eur, cost_tokens)
      values (v_mid, v_eur, v_tokens)
      on conflict (merchant_id, amount_eur) do update set cost_tokens = excluded.cost_tokens;
    end loop;
  end if;
end;
$$;

revoke all on function public.complete_onboarding(public.app_role, text, text) from public;
grant execute on function public.complete_onboarding(public.app_role, text, text) to authenticated;