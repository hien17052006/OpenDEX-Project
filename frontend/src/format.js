import { formatUnits } from 'viem';

export const fmt = (value) => formatUnits(BigInt(value), 18);

export const short = (hash) => `${hash.slice(0, 8)}...${hash.slice(-6)}`;

export const txUrl = (hash) => `https://sepolia.arbiscan.io/tx/${hash}`;