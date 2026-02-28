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

<img width="706" height="880" alt="Screenshot 2026-02-28 at 3 01 04 PM" src="https://github.com/user-attachments/assets/152ca1f7-bf45-4754-89dc-3db782e68761" />


---

## Features

- **Live prices** — fetch prices for any coin across multiple currencies
- **Market overview** — ranked market cap table with 24h change and volume
- **Trending** — top 15 coins, top 7 NFTs, and top 6 categories trending on CoinGecko
- **Historical data** — single-date snapshots, relative ranges, or custom date ranges
- **Auto-pagination** — fetch more than 250 coins seamlessly across API pages
- **Smart chunking** — date ranges > 90 days are automatically split and stitched
- **Symbol resolution** — use `btc`, `eth`, `sol` instead of remembering coin IDs
- **Full-text search** — find any coin by name or ticker
- **Persistent auth** — API key stored securely in your OS config directory
- **Demo & Pro support** — works with both CoinGecko API tiers
- **CSV Export** — save market or historical data to a CSV file with `--export`

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
cg auth                                       # Configure your API key
cg price --ids bitcoin                        # Get BTC price in USD
cg markets --total 50                         # Top 50 coins by market cap
cg search solana                              # Search for a coin
cg trending                                   # Trending coins, NFTs & categories
cg history bitcoin --days 30                  # 30-day price chart
cg history bitcoin --date 2024-01-01          # Single date snapshot
cg history bitcoin --from 2023-01-01 --to 2024-01-01  # 1-year range
cg status                                     # Check saved credentials
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

### `trending`

Display what's trending on CoinGecko right now — updated every few minutes by the CoinGecko platform.

```bash
cg trending
```

Renders three tables with live 24h data:

| Table | Contents |
|---|---|
| Top 15 Trending Coins | Name, symbol, market cap rank, price, 24h change |
| Top 7 Trending NFTs | Collection name, floor price, 24h change |
| Top 6 Trending Categories | Category name, coin count, market cap, 24h change |

---

### `history`

Fetch historical price, market cap, and volume data for any coin. Three routing modes are available depending on the flags you provide.

#### Case A — Single date snapshot

Uses `/coins/{id}/history`. Returns the price at a specific date.

```bash
cg history bitcoin --date 2024-01-01
cg history ethereum --date 2021-11-10 --vs eur
```

#### Case B — Relative range

Uses `/coins/{id}/market_chart`. Returns hourly data for 1 day, daily data for longer periods.

```bash
cg history bitcoin --days 7
cg history solana --days 90 --export solana_90d.csv
```

#### Case C — Custom date range

Uses `/coins/{id}/market_chart/range`. Provide a start and end date.

```bash
cg history bitcoin --from 2024-01-01 --to 2024-06-30
cg history ethereum --from 2022-01-01 --to 2023-12-31 --export eth_2yr.csv
```

> **Smart chunking:** if the requested range exceeds 90 days, the CLI automatically splits it into ≤90-day segments, fetches each in sequence, and stitches the results into a single dataset before display.

**Shared options:**

| Option | Description | Default |
|---|---|---|
| `--date` | Single date (YYYY-MM-DD) | — |
| `--days` | Number of days back | — |
| `--from` | Range start date (YYYY-MM-DD) | — |
| `--to` | Range end date (YYYY-MM-DD) | — |
| `--vs` | Quote currency | `usd` |
| `--export` | Save results to a CSV file | — |

The terminal table displays the most recent 50 data points. Use `--export` to get the full dataset as a CSV.

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
