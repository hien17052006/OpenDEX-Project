import pg from 'pg';
import { config } from './config.js';

const pool = new pg.Pool({ connectionString: config.databaseUrl });

const toOrder = (r) => ({
  seq: Number(r.seq),
  hash: r.hash,
  trader: r.trader,
  isBuy: r.is_buy,
  price: BigInt(r.price),
  amount: BigInt(r.amount),
  filled: BigInt(r.filled),
  nonce: BigInt(r.nonce),
  expiry: BigInt(r.expiry),
  signature: r.signature,
  status: r.status,
});

export async function insertOrder(o) {
  const { rows } = await pool.query(
    `INSERT INTO orders (hash, trader, is_buy, price, amount, nonce, expiry, signature)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING seq`,
    [o.hash, o.trader, o.isBuy, o.price.toString(), o.amount.toString(),
     o.nonce.toString(), o.expiry.toString(), o.signature]
  );
  return Number(rows[0].seq);
}

export const updateFilled = (hash, filled, status) =>
  pool.query('UPDATE orders SET filled = $2, status = $3 WHERE hash = $1',
    [hash, filled.toString(), status]);

export const setStatus = (hash, status) =>
  pool.query('UPDATE orders SET status = $2 WHERE hash = $1', [hash, status]);

export const insertTrade = (t) =>
  pool.query(
    `INSERT INTO trades (buy_hash, sell_hash, buyer, seller, price, amount, quote_amount, tx_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [t.buyHash, t.sellHash, t.buyer, t.seller, t.price.toString(),
     t.amount.toString(), t.quoteAmount.toString(), t.txHash]
  );

export async function loadOpenOrders() {
  const { rows } = await pool.query("SELECT * FROM orders WHERE status = 'open' ORDER BY seq");
  return rows.map(toOrder);
}

export async function listTrades(limit = 50) {
  const { rows } = await pool.query('SELECT * FROM trades ORDER BY id DESC LIMIT $1', [limit]);
  return rows;
}

export async function listOrdersByTrader(trader) {
  const { rows } = await pool.query(
    'SELECT * FROM orders WHERE lower(trader) = lower($1) ORDER BY seq DESC LIMIT 100',
    [trader]
  );
  return rows;
}