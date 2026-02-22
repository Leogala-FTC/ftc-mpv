insert into public.merchants (id, name, status)
values ('00000000-0000-0000-0000-000000000001', 'Merchant 1', 'active')
on conflict (id) do nothing;

insert into public.merchant_wallets (merchant_id, available_tokens, pending_tokens)
values ('00000000-0000-0000-0000-000000000001', 0, 0)
on conflict (merchant_id) do nothing;

insert into public.merchant_pricing (merchant_id, amount_eur, cost_tokens) values
('00000000-0000-0000-0000-000000000001',5,72),
('00000000-0000-0000-0000-000000000001',6,86),
('00000000-0000-0000-0000-000000000001',7,100),
('00000000-0000-0000-0000-000000000001',8,114),
('00000000-0000-0000-0000-000000000001',9,128),
('00000000-0000-0000-0000-000000000001',10,142),
('00000000-0000-0000-0000-000000000001',11,156),
('00000000-0000-0000-0000-000000000001',12,170),
('00000000-0000-0000-0000-000000000001',13,184),
('00000000-0000-0000-0000-000000000001',14,198),
('00000000-0000-0000-0000-000000000001',15,212),
('00000000-0000-0000-0000-000000000001',16,226),
('00000000-0000-0000-0000-000000000001',18,254),
('00000000-0000-0000-0000-000000000001',20,282),
('00000000-0000-0000-0000-000000000001',25,352)
on conflict (merchant_id, amount_eur) do update set cost_tokens = excluded.cost_tokens;

insert into public.topup_packs (id, name, tokens, sort_order, is_active) values
(1, 'Soap Starter', 450, 1, true),
(2, 'Soap Plus', 820, 2, true),
(3, 'Soap Pro', 1380, 3, true),
(4, 'Soap Ultra', 1750, 4, true)
on conflict (id) do update set name=excluded.name, tokens=excluded.tokens, sort_order=excluded.sort_order, is_active=excluded.is_active;

insert into public.treasury_wallet (id, balance_tokens) values (1, 0)
on conflict (id) do nothing;

insert into public.app_settings (id, token_eur_rate_estimate, session_ttl_seconds)
values (1, 0.02, 90)
on conflict (id) do update set token_eur_rate_estimate = excluded.token_eur_rate_estimate, session_ttl_seconds = excluded.session_ttl_seconds;
