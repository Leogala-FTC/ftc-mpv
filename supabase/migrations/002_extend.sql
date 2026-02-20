-- Extend schema for FTC MVP enhancements

-- Add extra fields to profiles for contact information
alter table public.profiles
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists province text;

-- Add extended company fields to merchants
alter table public.merchants
  add column if not exists legal_name text,
  add column if not exists vat_number text,
  add column if not exists tax_code text,
  add column if not exists ateco_code text,
  add column if not exists pec text,
  add column if not exists sdi_code text,
  add column if not exists address text,
  add column if not exists cap text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists sector text,
  add column if not exists subsector text,
  add column if not exists description text,
  add column if not exists iban text;

-- Table to track topup requests from users
create table if not exists public.topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  pack_id int references public.topup_packs(id),
  tokens numeric(18,2) not null,
  eur_estimate numeric(10,2) not null default 0,
  status text not null default 'pending', -- pending, completed, cancelled
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Enable RLS on topup_requests and define policies
alter table public.topup_requests enable row level security;

-- Re-create is_admin helper (idempotent)
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

drop policy if exists topup_requests_select on public.topup_requests;
create policy topup_requests_select on public.topup_requests
for select to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists topup_requests_insert on public.topup_requests;
create policy topup_requests_insert on public.topup_requests
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists topup_requests_update on public.topup_requests;
create policy topup_requests_update on public.topup_requests
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Function to credit tokens to a user by id and create a completed topup request
create or replace function public.admin_topup_user(p_user_id uuid, p_tokens numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- update user wallet
  update public.user_wallets
  set balance_tokens = balance_tokens + p_tokens,
      updated_at = now()
  where user_id = p_user_id;

  -- record token transaction
  insert into public.token_transactions (user_id, type, amount_tokens, metadata)
  values (p_user_id, 'topup', p_tokens, jsonb_build_object('admin', true));

  -- insert completed topup request for history
  insert into public.topup_requests (user_id, tokens, status, created_at, completed_at)
  values (p_user_id, p_tokens, 'completed', now(), now());
end;
$$;

revoke all on function public.admin_topup_user(uuid, numeric) from public;
grant execute on function public.admin_topup_user(uuid, numeric) to authenticated;

-- Helper function to credit tokens by user email
create or replace function public.admin_topup_by_email(p_email text, p_tokens numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
begin
  select id into v_uid from auth.users where email = p_email;
  if not found then
    raise exception 'Utente non trovato';
  end if;
  perform public.admin_topup_user(v_uid, p_tokens);
end;
$$;

revoke all on function public.admin_topup_by_email(text, numeric) from public;
grant execute on function public.admin_topup_by_email(text, numeric) to authenticated;