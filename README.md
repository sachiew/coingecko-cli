# CoinGecko CLI

> Real-time crypto data from your terminal, powered by the [CoinGecko API](https://www.coingecko.com/en/api).

```
  ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ ███████╗ ██████╗██╗  ██╗ ██████╗
 ██╔════╝██╔═══██╗██║████╗  ██║██╔════╝ ██╔════╝██╔════╝██║ ██╔╝██╔═══██╗
 ██║     ██║   ██║██║██╔██╗ ██║██║  ███╗█████╗  ██║     █████╔╝ ██║   ██║
 ██║     ██║   ██║██║██║╚██╗██║██║   ██║██╔══╝  ██║     ██╔═██╗ ██║   ██║
 ╚██████╗╚██████╔╝██║██║ ╚████║╚██████╔╝███████╗╚██████╗██║  ██╗╚██████╔╝
  ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝
```

[![npm version](https://img.shields.io/npm/v/@sachiew/coingecko-cli)](https://www.npmjs.com/package/@sachiew/coingecko-cli)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

- **Live prices** — fetch prices for any coin across multiple currencies
- **Market overview** — ranked market cap table with 24h change and volume
- **Auto-pagination** — fetch more than 250 coins seamlessly across API pages
- **Symbol resolution** — use `btc`, `eth`, `sol` instead of remembering coin IDs
- **Full-text search** — find any coin by name or ticker
- **Persistent auth** — API key stored securely in your OS config directory
- **Demo & Pro support** — works with both CoinGecko API tiers
- **CSV Export** — save market data to a CSV file with `--export`

---

## Installation

### Try it instantly (No install required)
```bash
npx @sachiew/coingecko-cli
```

### Global Installation
```bash
npm install -g @sachiew/coingecko-cli
```
This registers two global commands: `coingecko` and the shorter alias `cg`.

### Local development

```bash
git clone https://github.com/sachiew/coingecko-cli.git
cd coingecko-cli
npm install
npm link
```

---

## Requirements

| Requirement | Version |
|---|---|
| Node.js | >= 18.0.0 |
| CoinGecko API key | Free tier available |

Get a free API key at [coingecko.com/en/api](https://www.coingecko.com/en/api).

---

## Quick Start

```bash
cg auth                        # Configure your API key
cg price --ids bitcoin         # Get BTC price in USD
cg markets --total 50          # Top 50 coins by market cap
cg search solana               # Search for a coin
cg status                      # Check saved credentials
```

Run `cg` with no arguments to open the branded landing screen.

---

## Commands

### `auth`

Interactively configure your CoinGecko API key and plan tier. Your credentials are stored locally in your OS config directory (never sent anywhere else).

```bash
# Interactive flow (recommended)
cg auth

# Non-interactive (useful in scripts/CI)
cg auth --key YOUR_API_KEY --tier demo
cg auth --key YOUR_API_KEY --tier pro
```

| Option | Description |
|---|---|
| `--key` | Your CoinGecko API key |
| `--tier` | `demo` (free) or `pro` (paid) |

---

### `price`

Fetch the current price, 24h change, and market cap for one or more coins.

```bash
# Single coin
cg price --ids bitcoin

# Multiple coins, multiple currencies
cg price --ids bitcoin,ethereum,solana --vs usd,eur,gbp

# Use ticker symbols instead of IDs
cg price --symbols btc,eth,sol
```

| Option | Description | Default |
|---|---|---|
| `--ids` | Coin IDs, comma-separated | `bitcoin` |
| `--symbols` | Ticker symbols — auto-resolved to IDs via `/search` | — |
| `--vs` | Quote currencies, comma-separated | `usd` |

**Example output:**

```
┌───────────────┬──────────────┬───────────────────┐
│ Coin          │ USD Price    │ 24h Change (USD)  │
├───────────────┼──────────────┼───────────────────┤
│ bitcoin       │ $97,432.00   │ ▲ 2.14%           │
│ ethereum      │ $3,241.58    │ ▼ 0.87%           │
└───────────────┴──────────────┴───────────────────┘
```

---

### `markets`

Display a ranked table of the top coins by market cap, with price, 24h change, market cap, and volume.

```bash
# Default: top 100
cg markets

# Top 500 coins (auto-paginates)
cg markets --total 500

# Top 50 in EUR, sorted by market cap
cg markets --total 50 --vs eur --order market_cap_desc

# Export top 300 coins to CSV
cg markets --total 300 --export top_coins.csv
```

| Option | Description | Default |
|---|---|---|
| `--total` | Number of coins to fetch | `100` |
| `--vs` | Quote currency | `usd` |
| `--order` | Sort order (see CoinGecko API docs) | `market_cap_desc` |
| `--export` | Save results to a CSV file | — |

**Auto-pagination:** the CoinGecko API returns a maximum of 250 coins per request. If `--total` exceeds 250, the CLI automatically fetches additional pages and merges the results — no extra flags needed.

```bash
# This transparently fetches 3 pages behind the scenes
cg markets --total 700
```

**Example output:**

```
┌─────┬──────────────────────┬────────┬────────────────┬────────────┬──────────────┬──────────────┐
│   # │ Coin                 │ Symbol │ Price (USD)    │ 24h Change │ Market Cap   │ 24h Volume   │
├─────┼──────────────────────┼────────┼────────────────┼────────────┼──────────────┼──────────────┤
│   1 │ Bitcoin              │ BTC    │ $97,432.00     │ ▲ 2.14%   │ $1.93T       │ $38.21B      │
│   2 │ Ethereum             │ ETH    │ $3,241.58      │ ▼ 0.87%   │ $389.74B     │ $18.64B      │
│   3 │ Tether               │ USDT   │ $1.00          │ ▲ 0.01%   │ $140.53B     │ $92.11B      │
└─────┴──────────────────────┴────────┴────────────────┴────────────┴──────────────┴──────────────┘
```

---

### `search`

Search for any coin by name or ticker symbol. Returns the coin ID needed for other commands.

```bash
cg search bitcoin
cg search ethereum --limit 5
cg search "wrapped steth"
```

| Option | Description | Default |
|---|---|---|
| `--limit` | Max number of results to display | `10` |

---

### `status`

Display your currently saved API credentials (key is masked for security).

```bash
cg status
```

```
  ✔  Credentials configured
     Tier  pro
     Key   CG-zEF**********************
```

---

## API Tiers

| Feature | Demo (Free) | Pro (Paid) |
|---|---|---|
| Endpoint | `api.coingecko.com` | `pro-api.coingecko.com` |
| Rate limit | ~30 calls/min | Higher limits |
| Historical data | Limited | Full access |

Switch tiers at any time by re-running `cg auth`.

---

## License

MIT © [sachiew](https://github.com/sachiew)
