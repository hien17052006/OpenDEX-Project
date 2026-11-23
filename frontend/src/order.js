import { parseUnits, parseAbi } from 'viem';

export const ORDER_TYPES = {
  Order: [
    { name: 'trader', type: 'address' },
    { name: 'isBuy', type: 'bool' },
    { name: 'price', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
};

export const dexAbi = parseAbi([
  'function cancel((address trader, bool isBuy, uint256 price, uint256 amount, uint256 nonce, uint256 expiry) o)',
]);

export const buildDomain = (cfg) => ({
  name: 'OpenDEX',
  version: '1',
  chainId: cfg.chainId,
  verifyingContract: cfg.dex,
});

export const buildOrder = ({ trader, isBuy, price, amount }) => ({
  trader,
  isBuy,
  price: parseUnits(price, 18),
  amount: parseUnits(amount, 18),
  nonce: BigInt(Date.now()),
  expiry: BigInt(Math.floor(Date.now() / 1000) + 86400),
});

export const serializeOrder = (order) => ({
  ...order,
  price: order.price.toString(),
  amount: order.amount.toString(),
  nonce: order.nonce.toString(),
  expiry: order.expiry.toString(),
});