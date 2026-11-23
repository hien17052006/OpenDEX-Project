import { readFileSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  hashTypedData,
  http,
  parseAbi,
  verifyTypedData,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { config } from './config.js';

const artifact = JSON.parse(
  readFileSync(new URL('../../contracts/out/OpenDEX.sol/OpenDEX.json', import.meta.url), 'utf8')
);
export const dexAbi = artifact.abi;

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
]);

export const PRICE_SCALE = 10n ** 18n;

const account = privateKeyToAccount(config.operatorKey);

export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(config.rpcUrl),
});

const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(config.rpcUrl),
});

export const domain = {
  name: 'OpenDEX',
  version: '1',
  chainId: arbitrumSepolia.id,
  verifyingContract: config.dex,
};

export const types = {
  Order: [
    { name: 'trader', type: 'address' },
    { name: 'isBuy', type: 'bool' },
    { name: 'price', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
};

export const toMessage = (o) => ({
  trader: o.trader,
  isBuy: o.isBuy,
  price: o.price,
  amount: o.amount,
  nonce: o.nonce,
  expiry: o.expiry,
});

export const orderHash = (o) =>
  hashTypedData({ domain, types, primaryType: 'Order', message: toMessage(o) });

export const verifySignature = (o, signature) =>
  verifyTypedData({
    address: o.trader,
    domain,
    types,
    primaryType: 'Order',
    message: toMessage(o),
    signature,
  });

export async function hasFunds(order, fillAmount, price) {
  const token = order.isBuy ? config.usdx : config.gold;
  const needed = order.isBuy ? (fillAmount * price) / PRICE_SCALE : fillAmount;
  const [balance, allowance] = await Promise.all([
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [order.trader] }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [order.trader, config.dex] }),
  ]);
  return balance >= needed && allowance >= needed;
}

export async function settleOnChain(buy, sell, fillAmount, price) {
  const txHash = await walletClient.writeContract({
    address: config.dex,
    abi: dexAbi,
    functionName: 'settle',
    args: [toMessage(buy), buy.signature, toMessage(sell), sell.signature, fillAmount, price],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== 'success') throw new Error(`Settlement reverted: ${txHash}`);
  return txHash;
}

export const isCancelledOnChain = (hash) =>
  publicClient.readContract({
    address: config.dex,
    abi: dexAbi,
    functionName: 'cancelled',
    args: [hash],
  });