import { getOrderBook } from '../api.js';
import { usePolling } from '../hooks.js';
import { fmt } from '../format.js';

const Side = ({ title, levels, className }) => (
  <div>
    <h3>{title}</h3>
    <table>
      <thead>
        <tr><th>Price (USDx)</th><th>Amount (GOLD)</th></tr>
      </thead>
      <tbody>
        {levels.length === 0 && <tr><td colSpan="2">Empty</td></tr>}
        {levels.map((level) => (
          <tr key={level.price} className={className}>
            <td>{fmt(level.price)}</td>
            <td>{fmt(level.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function OrderBook() {
  const book = usePolling(getOrderBook, []);
  const asks = [...(book?.asks ?? [])].reverse();
  const bids = book?.bids ?? [];

  return (
    <section className="card">
      <h2>Order book</h2>
      <Side title="Asks (sell)" levels={asks} className="ask" />
      <Side title="Bids (buy)" levels={bids} className="bid" />
    </section>
  );
}