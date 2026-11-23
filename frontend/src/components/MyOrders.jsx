import { useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { confirmCancel, getOrders } from '../api.js';
import { usePolling } from '../hooks.js';
import { dexAbi } from '../order.js';
import { fmt, short, txUrl } from '../format.js';

export default function MyOrders({ cfg, address }) {
  const orders = usePolling(() => getOrders(address), [address]);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [cancelTx, setCancelTx] = useState('');
  const [error, setError] = useState('');

  const cancel = async (order) => {
    setError('');
    try {
      const txHash = await writeContractAsync({
        address: cfg.dex,
        abi: dexAbi,
        functionName: 'cancel',
        args: [
          {
            trader: order.trader,
            isBuy: order.is_buy,
            price: BigInt(order.price),
            amount: BigInt(order.amount),
            nonce: BigInt(order.nonce),
            expiry: BigInt(order.expiry),
          },
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await confirmCancel(order.hash);
      setCancelTx(txHash);
    } catch (e) {
      setError(e.shortMessage ?? e.message);
    }
  };

  return (
    <section className="card">
      <h2>My orders</h2>
      <table>
        <thead>
          <tr>
            <th>Hash</th><th>Side</th><th>Price</th><th>Amount</th><th>Filled</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {(orders ?? []).map((order) => (
            <tr key={order.hash}>
              <td>{short(order.hash)}</td>
              <td>{order.is_buy ? 'Buy' : 'Sell'}</td>
              <td>{fmt(order.price)}</td>
              <td>{fmt(order.amount)}</td>
              <td>{fmt(order.filled)}</td>
              <td>{order.status}</td>
              <td>
                {order.status === 'open' && <button onClick={() => cancel(order)}>Cancel</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cancelTx && (
        <p>
          Cancelled on-chain: <a href={txUrl(cancelTx)} target="_blank" rel="noreferrer">{short(cancelTx)}</a>
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}