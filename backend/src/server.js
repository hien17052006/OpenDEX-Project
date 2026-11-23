import cors from 'cors';
import express from 'express';
import { getAddress } from 'viem';
import { config } from './config.js';
import * as db from './db.js';
import { hasFunds, isCancelledOnChain, orderHash, verifySignature } from './chain.js';
import { OrderBook } from './orderbook.js';
import { processOrder } from './matcher.js';

const book = new OrderBook();
for (const order of await db.loadOpenOrders()) book.add(order);

let tail = Promise.resolve();
const serial = (task) => {
  const run = tail.then(task);
  tail = run.catch(() => {});
  return run;
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const parseOrder = (raw) => {
  try {
    return {
      trader: getAddress(raw.trader),
      isBuy: Boolean(raw.isBuy),
      price: BigInt(raw.price),
      amount: BigInt(raw.amount),
      nonce: BigInt(raw.nonce),
      expiry: BigInt(raw.expiry),
      filled: 0n,
      status: 'open',
    };
  } catch {
    throw new HttpError(400, 'Malformed order');
  }
};

const serializeOrder = (o) => ({
  hash: o.hash,
  trader: o.trader,
  isBuy: o.isBuy,
  price: o.price.toString(),
  amount: o.amount.toString(),
  filled: o.filled.toString(),
  status: o.status,
});

const serializeTrade = (t) => ({
  buyHash: t.buyHash,
  sellHash: t.sellHash,
  buyer: t.buyer,
  seller: t.seller,
  price: t.price.toString(),
  amount: t.amount.toString(),
  quoteAmount: t.quoteAmount.toString(),
  txHash: t.txHash,
});

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Order already exists' });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    console.error(error);
    res.status(500).json({ error: 'Internal error' });
  }
};

const app = express();
app.use(cors());
app.use(express.json());

app.get('/config', (_req, res) => {
  res.json({ dex: config.dex, gold: config.gold, usdx: config.usdx, chainId: 421614 });
});

app.get('/orderbook', (_req, res) => {
  res.json({ bids: book.levels(true), asks: book.levels(false) });
});

app.get('/trades', handle(async (_req, res) => {
  res.json(await db.listTrades());
}));

app.get('/orders', handle(async (req, res) => {
  if (!req.query.trader) throw new HttpError(400, 'trader is required');
  res.json(await db.listOrdersByTrader(String(req.query.trader)));
}));

app.post('/orders', handle(async (req, res) => {
  const { order: raw, signature } = req.body ?? {};
  if (!raw || !signature) throw new HttpError(400, 'order and signature are required');

  const order = parseOrder(raw);
  if (order.price <= 0n || order.amount <= 0n) throw new HttpError(400, 'Price and amount must be positive');
  if (order.expiry <= BigInt(Math.floor(Date.now() / 1000))) throw new HttpError(400, 'Order already expired');

  order.signature = signature;
  order.hash = orderHash(order);

  const valid = await verifySignature(order, signature).catch(() => false);
  if (!valid) throw new HttpError(400, 'Invalid signature');

  if (!(await hasFunds(order, order.amount, order.price))) {
    throw new HttpError(400, 'Insufficient balance or allowance');
  }

  const result = await serial(async () => {
    order.seq = await db.insertOrder(order);
    const trades = await processOrder(book, order);
    return { order: serializeOrder(order), trades: trades.map(serializeTrade) };
  });
  res.status(201).json(result);
}));

app.post('/orders/:hash/cancel', handle(async (req, res) => {
  const { hash } = req.params;
  if (!(await isCancelledOnChain(hash))) throw new HttpError(400, 'Order is not cancelled on-chain yet');
  await serial(async () => {
    book.removeByHash(hash);
    await db.setStatus(hash, 'cancelled');
  });
  res.json({ hash, status: 'cancelled' });
}));

app.listen(config.port, () => console.log(`OpenDEX backend listening on port ${config.port}`));