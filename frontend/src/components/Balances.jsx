import { useEffect, useState } from 'react';
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, maxUint256 } from 'viem';
import { fmt, txUrl, short } from '../format.js';

const display = (value) => (value >= 2n ** 200n ? 'Unlimited' : fmt(value));

export default function Balances({ cfg, address }) {
  const tokens = [
    { symbol: 'GOLD', address: cfg.gold },
    { symbol: 'USDx', address: cfg.usdx },
  ];
  const [error, setError] = useState('');

  const { data, refetch } = useReadContracts({
    contracts: tokens.flatMap((token) => [
      { address: token.address, abi: erc20Abi, functionName: 'balanceOf', args: [address] },
      { address: token.address, abi: erc20Abi, functionName: 'allowance', args: [address, cfg.dex] },
    ]),
    query: { refetchInterval: 5000 },
  });

  const { writeContractAsync, data: txHash } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (receipt.isSuccess) refetch();
  }, [receipt.isSuccess]);

  const approve = async (token) => {
    setError('');
    try {
      await writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [cfg.dex, maxUint256],
      });
    } catch (e) {
      setError(e.shortMessage ?? e.message);
    }
  };

  return (
    <section className="card">
      <h2>Balances</h2>
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Balance</th>
            <th>Allowance to DEX</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => (
            <tr key={token.symbol}>
              <td>{token.symbol}</td>
              <td>{display(data?.[i * 2]?.result ?? 0n)}</td>
              <td>{display(data?.[i * 2 + 1]?.result ?? 0n)}</td>
              <td>
                <button onClick={() => approve(token.address)}>Approve</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {txHash && (
        <p>
          Last approval: <a href={txUrl(txHash)} target="_blank" rel="noreferrer">{short(txHash)}</a>
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}