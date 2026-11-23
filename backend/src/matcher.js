import { hasFunds, settleOnChain, PRICE_SCALE } from './chain.js';
import { remaining } from './orderbook.js';
import * as db from './db.js';

const smaller = (a, b) => (a < b ? a : b);

const crosses = (incoming, resting) =>
  incoming.isBuy ? incoming.price >= resting.price : incoming.price <= resting.price;

async function reject(book, order, status) {
  book.remove(order);
  order.status = status;
  await db.setStatus(order.hash, status);
}

async function persistFill(book, order) {
  const done = remaining(order) === 0n;
  if (done) {
    order.status = 'filled';
    book.remove(order);
  }
  await db.updateFilled(order.hash, order.filled, order.status);
}

export async function processOrder(book, incoming) {
  const trades = [];
  const opposite = incoming.isBuy ? book.asks : book.bids;

  while (remaining(incoming) > 0n && opposite.length > 0) {
    const resting = opposite[0];
    if (!crosses(incoming, resting)) break;

    if (resting.expiry <= BigInt(Math.floor(Date.now() / 1000))) {
      await reject(book, resting, 'expired');
      continue;
    }

    const fillAmount = smaller(remaining(incoming), remaining(resting));
    const price = resting.price;
    const [buy, sell] = incoming.isBuy ? [incoming, resting] : [resting, incoming];

    if (!(await hasFunds(resting, fillAmount, price))) {
      await reject(book, resting, 'rejected');
      continue;
    }
    if (!(await hasFunds(incoming, fillAmount, price))) {
      incoming.status = 'rejected';
      await db.setStatus(incoming.hash, 'rejected');
      return trades;
    }

    let txHash;
    try {
      txHash = await settleOnChain(buy, sell, fillAmount, price);
    } catch (error) {
      console.error('Settlement failed:', error.shortMessage ?? error.message);
      await reject(book, resting, 'rejected');
      continue;
    }

    buy.filled += fillAmount;
    sell.filled += fillAmount;

    const trade = {
      buyHash: buy.hash,
      sellHash: sell.hash,
      buyer: buy.trader,
      seller: sell.trader,
      price,
      amount: fillAmount,
      quoteAmount: (fillAmount * price) / PRICE_SCALE,
      txHash,
    };
    await db.insertTrade(trade);
    await persistFill(book, resting);
    await persistFill(book, incoming);
    trades.push(trade);
    console.log('Trade settled:', txHash);
  }

  if (incoming.status === 'open' && remaining(incoming) > 0n) book.add(incoming);
  return trades;
}