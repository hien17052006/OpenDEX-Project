CREATE TABLE IF NOT EXISTS orders (
  seq BIGSERIAL PRIMARY KEY,
  hash TEXT UNIQUE NOT NULL,
  trader TEXT NOT NULL,
  is_buy BOOLEAN NOT NULL,
  price NUMERIC(78,0) NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  filled NUMERIC(78,0) NOT NULL DEFAULT 0,
  nonce NUMERIC(78,0) NOT NULL,
  expiry NUMERIC(78,0) NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_trader_idx ON orders (trader);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  buy_hash TEXT NOT NULL,
  sell_hash TEXT NOT NULL,
  buyer TEXT NOT NULL,
  seller TEXT NOT NULL,
  price NUMERIC(78,0) NOT NULL,
  amount NUMERIC(78,0) NOT NULL,
  quote_amount NUMERIC(78,0) NOT NULL,
  tx_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);