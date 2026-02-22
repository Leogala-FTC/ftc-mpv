create extension if not exists pgcrypto;

create type public.app_role as enum ('user','merchant','admin');
create type public.tx_type as enum ('spend','topup');
create type public.payment_status as enum ('pending','paid','expired','cancelled');
create type public.clearing_status as enum ('pending','approved','rejected','paid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  name text not null,
  created_at timestamptz not null default now()
);

create table public.merchants (
  id uuid primary key,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.merchant_staff (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (merchant_id, user_id)
);

create table public.user_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_tokens numeric(18,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.merchant_wallets (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  available_tokens numeric(18,2) not null default 0,
  pending_tokens numeric(18,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.treasury_wallet (
  id int primary key check (id = 1),
  balance_tokens numeric(18,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table public.token_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  merchant_id uuid references public.merchants(id) on delete set null,
  type public.tx_type not null,
  amount_tokens numeric(18,2) not null check (amount_tokens > 0),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  amount_eur numeric(10,2) not null,
  amount_tokens numeric(18,2) not null,
  status public.payment_status not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.payment_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  merchant_id uuid not null references public.merchants(id),
  amount_eur numeric(10,2) not null,
  amount_tokens numeric(18,2) not null,
  created_at timestamptz not null default now()
);

create table public.merchant_pricing (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  amount_eur numeric(10,2) not null,
  cost_tokens numeric(18,2) not null,
  primary key (merchant_id, amount_eur)
);

create table public.topup_packs (
  id int primary key,
  name text not null,
  tokens numeric(18,2) not null,
  sort_order int not null,
  is_active boolean not null default true
);

create table public.app_settings (
  id int primary key check (id = 1),
  token_eur_rate_estimate numeric(10,4) not null default 0.02,
  session_ttl_seconds int not null default 90
);

create table public.clearing_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  requested_tokens numeric(18,2) not null check (requested_tokens > 0),
  eur_estimate numeric(12,2) not null,
  week_start date not null,
  status public.clearing_status not null default 'pending',
  requested_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  rejected_by uuid references auth.users(id),
  paid_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  unique (merchant_id, week_start)
);
