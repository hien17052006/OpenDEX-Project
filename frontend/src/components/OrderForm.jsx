import { useState } from 'react';
import { useSignTypedData } from 'wagmi';
import { postOrder } from '../api.js';
import { ORDER_TYPES, buildDomain, buildOrder, serializeOrder } from '../order.js';
import { fmt, short, txUrl } from '../format.js';

export default function OrderForm({ cfg, address }) {
  const [side, setSide] = useState('buy');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signTypedDataAsync } = useSignTypedData();

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const order = buildOrder({ trader: address, isBuy: side === 'buy', price, amount });
      const signature = await signTypedDataAsync({
        domain: buildDomain(cfg),
        types: ORDER_TYPES,
        primaryType: 'Order',
        message: order,
      });
      setResult(await postOrder(serializeOrder(order), signature));
    } catch (e) {
      setError(e.shortMessage ?? e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>Place limit order</h2>
      <form onSubmit={submit} className="form">
        <select value={side} onChange={(e) => setSide(e.target.value)}>
          <option value="buy">Buy GOLD</option>
          <option value="sell">Sell GOLD</option>
        </select>
        <input placeholder="Price (USDx per GOLD)" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input placeholder="Amount (GOLD)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button type="submit" disabled={busy}>{busy ? 'Working...' : 'Sign and submit'}</button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <div>
          <p>
            Order {short(result.order.hash)}: {result.order.status}, filled {fmt(result.order.filled)} of {fmt(result.order.amount)}
          </p>
          {result.trades.map((trade) => (
            <p key={trade.txHash}>
              Matched {fmt(trade.amount)} GOLD at {fmt(trade.price)} USDx:{' '}
              <a href={txUrl(trade.txHash)} target="_blank" rel="noreferrer">{short(trade.txHash)}</a>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}