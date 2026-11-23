import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';

export default function Wallet({ cfg }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <button onClick={() => connect({ connector: injected() })} disabled={isPending}>
        Connect MetaMask
      </button>
    );
  }

  return (
    <section className="card row">
      <span>Connected: {address}</span>
      {chainId !== cfg.chainId && (
        <button onClick={() => switchChain({ chainId: cfg.chainId })}>
          Switch to Arbitrum Sepolia
        </button>
      )}
      <button onClick={() => disconnect()}>Disconnect</button>
    </section>
  );
}