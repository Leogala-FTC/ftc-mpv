import { GetServerSideProps } from "next";
import { createClient } from "@supabase/supabase-js";

type AdminStats = {
  totalUserTokens: number;
  totalMerchantAvailableTokens: number;
  totalMerchantPendingTokens: number;
};

type WalletRow = { balance_tokens: number | null };
type MerchantWalletRow = { available_tokens: number | null; pending_tokens: number | null };

type Props = {
  stats: AdminStats;
};

export default function AdminIndexPage({ stats }: Props) {
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Admin Dashboard</h1>
      <ul>
        <li>Token utenti: {stats.totalUserTokens}</li>
        <li>Token merchant disponibili: {stats.totalMerchantAvailableTokens}</li>
        <li>Token merchant pending: {stats.totalMerchantPendingTokens}</li>
      </ul>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      props: {
        stats: {
          totalUserTokens: 0,
          totalMerchantAvailableTokens: 0,
          totalMerchantPendingTokens: 0,
        },
      },
    };
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: userWallets } = await supabase.from("user_wallets").select("balance_tokens");
  const totalUserTokens = (userWallets ?? []).reduce<number>((acc: number, wallet: WalletRow) => {
    return acc + Number(wallet.balance_tokens ?? 0);
  }, 0);

  const { data: merchantWallets } = await supabase
    .from("merchant_wallets")
    .select("available_tokens,pending_tokens");

  const totals = (merchantWallets ?? []).reduce<{ available: number; pending: number }>(
    (acc, wallet: MerchantWalletRow) => {
      return {
        available: acc.available + Number(wallet.available_tokens ?? 0),
        pending: acc.pending + Number(wallet.pending_tokens ?? 0),
      };
    },
    { available: 0, pending: 0 },
  );

  return {
    props: {
      stats: {
        totalUserTokens,
        totalMerchantAvailableTokens: totals.available,
        totalMerchantPendingTokens: totals.pending,
      },
    },
  };
};
