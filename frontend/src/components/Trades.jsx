import { getTrades } from '../api.js';
import { usePolling } from '../hooks.js';
import { fmt, short, txUrl } from '../format.js';

export default function Trades() {
  const trades = usePolling(getTrades, []);

  return (
    <section className="card">
      <h2>Trade history</h2>
      <table>
        <thead>
          <tr><th>Time</th><th>Price</th><th>Amount</th><th>Tx</th></tr>
        </thead>
        <tbody>
          {(trades ?? []).map((trade) => (
            <tr key={trade.id}>
              <td>{new Date(trade.created_at).toLocaleTimeString()}</td>
              <td>{fmt(trade.price)}</td>
              <td>{fmt(trade.amount)}</td>
              <td>
                <a href={txUrl(trade.tx_hash)} target="_blank" rel="noreferrer">{short(trade.tx_hash)}</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}