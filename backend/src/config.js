import 'dotenv/config';
import { getAddress } from 'viem';

const need = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env variable ${key}`);
  return value;
};

export const config = {
  rpcUrl: need('RPC_URL'),
  operatorKey: need('OPERATOR_KEY'),
  dex: getAddress(need('DEX_ADDRESS')),
  gold: getAddress(need('GOLD_ADDRESS')),
  usdx: getAddress(need('USDX_ADDRESS')),
  databaseUrl: need('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3001),
};