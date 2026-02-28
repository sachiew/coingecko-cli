# CoinGecko CLI

Real-time crypto data from your terminal, powered by the [CoinGecko API](https://www.coingecko.com/en/api).

```
cg markets --total 10
```

## Installation

```bash
npm install -g coingecko-cli
```

Or clone and link locally:

```bash
git clone git@github.com:sachiew/coingecko-cli.git
cd coingecko-cli
npm link
```

## Usage

Both `coingecko` and `cg` work interchangeably. `cg` is the official shortcut.

```bash
cg <command> [options]
```

## Commands

### `auth`
Save your CoinGecko API key and plan tier.

```bash
cg auth
cg auth --key YOUR_API_KEY --tier demo
cg auth --key YOUR_API_KEY --tier pro
```

Get a free API key at [coingecko.com/en/api](https://www.coingecko.com/en/api).

---

### `price`
Get the current price of one or more coins.

```bash
cg price --ids bitcoin
cg price --ids bitcoin,ethereum --vs usd,eur
cg price --symbols btc,eth,sol
```

| Option | Description | Default |
|---|---|---|
| `--ids` | Coin IDs (comma-separated) | `bitcoin` |
| `--symbols` | Coin symbols — auto-resolved to IDs | — |
| `--vs` | vs currencies (comma-separated) | `usd` |

---

### `markets`
List top coins ranked by market cap.

```bash
cg markets
cg markets --total 500
cg markets --total 50 --vs eur --order market_cap_desc
```

| Option | Description | Default |
|---|---|---|
| `--total` | Number of coins to fetch | `100` |
| `--vs` | vs currency | `usd` |
| `--order` | Sort order | `market_cap_desc` |

Automatically paginates across multiple API pages if `--total` exceeds 250.

---

### `search`
Search for coins by name or symbol.

```bash
cg search bitcoin
cg search ethereum --limit 5
```

| Option | Description | Default |
|---|---|---|
| `--limit` | Max results to display | `10` |

---

### `status`
Show your currently configured API credentials.

```bash
cg status
```

## Requirements

- Node.js >= 18
- A CoinGecko API key (free tier available)

## License

MIT
