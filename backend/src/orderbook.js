const comparator = (isBuy) => (a, b) => {
  if (a.price !== b.price) {
    const better = isBuy ? a.price > b.price : a.price < b.price;
    return better ? -1 : 1;
  }
  return a.seq - b.seq;
};

export const remaining = (order) => order.amount - order.filled;

export class OrderBook {
  constructor() {
    this.bids = [];
    this.asks = [];
  }

  side(isBuy) {
    return isBuy ? this.bids : this.asks;
  }

  add(order) {
    const side = this.side(order.isBuy);
    side.push(order);
    side.sort(comparator(order.isBuy));
  }

  remove(order) {
    const side = this.side(order.isBuy);
    const index = side.findIndex((o) => o.hash === order.hash);
    if (index >= 0) side.splice(index, 1);
  }

  removeByHash(hash) {
    for (const side of [this.bids, this.asks]) {
      const index = side.findIndex((o) => o.hash === hash);
      if (index >= 0) return side.splice(index, 1)[0];
    }
    return null;
  }

  levels(isBuy) {
    const result = [];
    for (const order of this.side(isBuy)) {
      const last = result[result.length - 1];
      if (last && last.price === order.price) {
        last.amount += remaining(order);
      } else {
        result.push({ price: order.price, amount: remaining(order) });
      }
    }
    return result.map((l) => ({ price: l.price.toString(), amount: l.amount.toString() }));
  }
}