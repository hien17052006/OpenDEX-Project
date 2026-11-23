import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { getConfig } from './api.js';
import Wallet from './components/Wallet.jsx';
import Balances from './components/Balances.jsx';
import OrderForm from './components/OrderForm.jsx';
import OrderBook from './components/OrderBook.jsx';
import MyOrders from './components/MyOrders.jsx';
import Trades from './components/Trades.jsx';

export default function App() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState('');
  const { address, isConnected, chainId } = useAccount();

  useEffect(() => {
    getConfig().then(setCfg).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">Cannot reach backend: {error}</p>;
  if (!cfg) return <p>Loading...</p>;

  const ready = isConnected && chainId === cfg.chainId;

  return (
    <main>
      <h1>OpenDEX: GOLD / USDx</h1>
      <Wallet cfg={cfg} />
      {ready && (
        <div className="grid">
          <Balances cfg={cfg} address={address} />
          <OrderForm cfg={cfg} address={address} />
          <OrderBook />
          <Trades />
          <MyOrders cfg={cfg} address={address} />
        </div>
      )}
    </main>
  );
}
