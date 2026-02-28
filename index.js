#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import Conf from 'conf';
import chalk from 'chalk';
import Table from 'cli-table3';
import readline from 'readline';

// ─── Config Store ────────────────────────────────────────────────────────────
const config = new Conf({ projectName: 'coingecko-cli' });

// ─── API Helpers ─────────────────────────────────────────────────────────────
const BASE_URLS = {
  demo: 'https://api.coingecko.com/api/v3',
  pro:  'https://pro-api.coingecko.com/api/v3',
};

const HEADER_KEYS = {
  demo: 'x-cg-demo-api-key',
  pro:  'x-cg-pro-api-key',
};

function getCredentials() {
  const apiKey = config.get('apiKey');
  const tier   = config.get('tier') || 'demo';
  return { apiKey, tier };
}

function makeHeaders() {
  const { apiKey, tier } = getCredentials();
  if (!apiKey) return {};
  return { [HEADER_KEYS[tier]]: apiKey };
}

function getBaseUrl() {
  const { tier } = getCredentials();
  return BASE_URLS[tier] || BASE_URLS.demo;
}

async function makeRequest(path, params = {}) {
  const url = `${getBaseUrl()}${path}`;
  try {
    const response = await axios.get(url, {
      headers: makeHeaders(),
      params,
    });
    return response.data;
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      if (status === 401) {
        console.error(chalk.red.bold('\n✖  Authentication Failed (401)'));
        console.error(chalk.yellow('   Your API key is invalid or missing.'));
        console.error(chalk.dim('   Run: coingecko auth\n'));
      } else if (status === 429) {
        console.error(chalk.red.bold('\n✖  Rate Limit Exceeded (429)'));
        console.error(chalk.yellow('   You have hit the API rate limit.'));
        console.error(chalk.dim('   Wait a moment and try again, or upgrade your CoinGecko plan.\n'));
      } else {
        console.error(chalk.red(`\n✖  API Error: ${status} — ${err.response.data?.error || err.message}\n`));
      }
    } else {
      console.error(chalk.red(`\n✖  Network Error: ${err.message}\n`));
    }
    process.exit(1);
  }
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────
function formatUSD(value) {
  if (value == null) return chalk.dim('N/A');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

function formatLargeUSD(value) {
  if (value == null) return chalk.dim('N/A');
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(2)}M`;
  return formatUSD(value);
}

function formatChange(value) {
  if (value == null) return chalk.dim('N/A');
  const fixed = value.toFixed(2) + '%';
  return value >= 0 ? chalk.green(`▲ ${fixed}`) : chalk.red(`▼ ${fixed}`);
}

function printBanner() {
  console.log(
    chalk.yellow.bold('\n  ◆ CoinGecko CLI') +
    chalk.dim('  —  Real-time crypto data\n')
  );
}

// ─── Prompt Helper ────────────────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ─── CLI Program ─────────────────────────────────────────────────────────────
const program = new Command();

program
  .name('coingecko')
  .description(
    chalk.yellow('CoinGecko CLI') + ' — real-time crypto data from the terminal\n\n' +
    chalk.dim('  Tip: ') + chalk.cyan('cg') + chalk.dim(' is the official shortcut for ') + chalk.cyan('coingecko') + chalk.dim(' — use it for faster access.')
  )
  .version('1.0.0', '-v, --version');

// ─── AUTH ─────────────────────────────────────────────────────────────────────
program
  .command('auth')
  .description('Save your CoinGecko API key and tier (demo/pro)')
  .option('--key <apiKey>', 'Your CoinGecko API key')
  .option('--tier <tier>', 'Your plan tier: demo or pro', 'demo')
  .action(async (opts) => {
    printBanner();
    console.log(chalk.cyan.bold('  Configure API Credentials\n'));

    let apiKey = opts.key;
    let tier   = opts.tier;

    if (!apiKey) {
      console.log(chalk.dim('  Get your free API key at: https://www.coingecko.com/en/api\n'));
      apiKey = await prompt(chalk.white('  Enter your API key: '));
    }

    if (!['demo', 'pro'].includes(tier)) {
      console.error(chalk.red('  ✖  Tier must be "demo" or "pro"'));
      process.exit(1);
    }

    if (!apiKey) {
      console.error(chalk.red('  ✖  API key cannot be empty'));
      process.exit(1);
    }

    config.set('apiKey', apiKey);
    config.set('tier', tier);

    console.log(chalk.green.bold('\n  ✔  Credentials saved successfully!'));
    console.log(chalk.dim(`     Tier : ${tier}`));
    console.log(chalk.dim(`     Key  : ${apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, apiKey.length - 6))}\n`));
  });

// ─── PRICE ────────────────────────────────────────────────────────────────────
program
  .command('price')
  .description('Get the current price of one or more coins')
  .option('--ids <ids>',         'Coin IDs (comma-separated, e.g. bitcoin,ethereum)', 'bitcoin')
  .option('--symbols <symbols>', 'Coin symbols to resolve first (e.g. btc,eth)')
  .option('--vs <currencies>',   'vs currencies (comma-separated)', 'usd')
  .action(async (opts) => {
    printBanner();

    let coinIds = opts.ids;

    // If --symbols provided, resolve them to IDs via /search
    if (opts.symbols) {
      const symbols = opts.symbols.split(',').map(s => s.trim().toLowerCase());
      console.log(chalk.dim(`  Resolving symbols: ${symbols.join(', ')}...\n`));

      const resolvedIds = [];
      for (const sym of symbols) {
        const result = await makeRequest('/search', { query: sym });
        const match = result.coins?.find(c => c.symbol.toLowerCase() === sym);
        if (match) {
          resolvedIds.push(match.id);
        } else {
          console.warn(chalk.yellow(`  ⚠  Symbol "${sym}" not found, skipping.`));
        }
      }

      if (!resolvedIds.length) {
        console.error(chalk.red('  ✖  No valid symbols resolved.'));
        process.exit(1);
      }
      coinIds = resolvedIds.join(',');
    }

    const ids         = coinIds.split(',').map(s => s.trim()).join(',');
    const vsCurrencies = opts.vs.split(',').map(s => s.trim()).join(',');

    console.log(chalk.dim(`  Fetching prices for: ${ids}\n`));

    const data = await makeRequest('/simple/price', {
      ids,
      vs_currencies: vsCurrencies,
      include_24hr_change: true,
      include_market_cap: true,
    });

    if (!Object.keys(data).length) {
      console.error(chalk.red('  ✖  No data returned. Check your coin IDs.'));
      process.exit(1);
    }

    const currencies = vsCurrencies.split(',');

    const table = new Table({
      head: [
        chalk.cyan.bold('Coin'),
        ...currencies.map(c => chalk.cyan.bold(c.toUpperCase() + ' Price')),
        ...currencies.map(c => chalk.cyan.bold('24h Change (' + c.toUpperCase() + ')')),
      ],
      style: { head: [], border: ['dim'] },
      colAligns: ['left', ...currencies.map(() => 'right'), ...currencies.map(() => 'right')],
    });

    for (const [coinId, values] of Object.entries(data)) {
      table.push([
        chalk.white.bold(coinId),
        ...currencies.map(c => chalk.yellow(formatUSD(values[c]))),
        ...currencies.map(c => formatChange(values[`${c}_24h_change`])),
      ]);
    }

    console.log(table.toString());
    console.log(chalk.dim(`  Data from CoinGecko  •  ${new Date().toLocaleTimeString()}\n`));
  });

// ─── MARKETS ─────────────────────────────────────────────────────────────────
program
  .command('markets')
  .description('List top coins by market cap')
  .option('--total <n>',    'Total number of coins to fetch (max limited by plan)', '100')
  .option('--vs <currency>', 'vs currency', 'usd')
  .option('--order <order>', 'Sort order', 'market_cap_desc')
  .action(async (opts) => {
    printBanner();

    const total    = Math.max(1, parseInt(opts.total, 10) || 100);
    const currency = opts.vs;
    const PER_PAGE = 250;

    const pagesNeeded = Math.ceil(total / PER_PAGE);

    if (pagesNeeded > 1) {
      console.log(
        chalk.cyan(`  Fetching ${total} coins across ${pagesNeeded} pages`) +
        chalk.dim(' (this may take a moment)...\n')
      );
    } else {
      console.log(chalk.dim(`  Fetching top ${total} coins by market cap...\n`));
    }

    let allCoins = [];
    const perPage = Math.min(PER_PAGE, total);

    for (let page = 1; page <= pagesNeeded; page++) {
      if (pagesNeeded > 1) {
        process.stdout.write(
          chalk.dim(`  ◌ Loading page ${page} of ${pagesNeeded}...`) + '\r'
        );
      }

      const coins = await makeRequest('/coins/markets', {
        vs_currency:           currency,
        order:                 opts.order,
        per_page:              perPage,
        page,
        sparkline:             false,
        price_change_percentage: '24h',
      });

      allCoins = allCoins.concat(coins);

      if (coins.length < perPage) break; // API returned fewer than requested — no more pages
    }

    allCoins = allCoins.slice(0, total);

    if (pagesNeeded > 1) {
      process.stdout.write('\r' + ' '.repeat(60) + '\r'); // clear loading line
    }

    if (!allCoins.length) {
      console.error(chalk.red('  ✖  No data returned.'));
      process.exit(1);
    }

    console.log(
      chalk.green.bold(`  ✔  Loaded ${allCoins.length} coins\n`)
    );

    const table = new Table({
      head: [
        chalk.cyan.bold('#'),
        chalk.cyan.bold('Coin'),
        chalk.cyan.bold('Symbol'),
        chalk.cyan.bold(`Price (${currency.toUpperCase()})`),
        chalk.cyan.bold('24h Change'),
        chalk.cyan.bold('Market Cap'),
        chalk.cyan.bold('24h Volume'),
      ],
      style: { head: [], border: ['dim'] },
      colAligns: ['right', 'left', 'left', 'right', 'right', 'right', 'right'],
      colWidths: [5, 22, 8, 16, 12, 14, 14],
    });

    for (const coin of allCoins) {
      table.push([
        chalk.dim(coin.market_cap_rank ?? '—'),
        chalk.white.bold(coin.name),
        chalk.dim(coin.symbol.toUpperCase()),
        chalk.yellow(formatUSD(coin.current_price)),
        formatChange(coin.price_change_percentage_24h),
        chalk.dim(formatLargeUSD(coin.market_cap)),
        chalk.dim(formatLargeUSD(coin.total_volume)),
      ]);
    }

    console.log(table.toString());
    console.log(chalk.dim(`  ${allCoins.length} coins  •  vs ${currency.toUpperCase()}  •  ${new Date().toLocaleTimeString()}\n`));
  });

// ─── SEARCH ──────────────────────────────────────────────────────────────────
program
  .command('search <query>')
  .description('Search for coins, exchanges, and categories')
  .option('--limit <n>', 'Max results to show', '10')
  .action(async (query, opts) => {
    printBanner();

    const limit = Math.max(1, parseInt(opts.limit, 10) || 10);
    console.log(chalk.dim(`  Searching for "${query}"...\n`));

    const data = await makeRequest('/search', { query });
    const coins = (data.coins || []).slice(0, limit);

    if (!coins.length) {
      console.log(chalk.yellow(`  No results found for "${query}".`));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan.bold('#'),
        chalk.cyan.bold('Name'),
        chalk.cyan.bold('Symbol'),
        chalk.cyan.bold('Coin ID'),
        chalk.cyan.bold('Market Cap Rank'),
      ],
      style: { head: [], border: ['dim'] },
      colAligns: ['right', 'left', 'left', 'left', 'right'],
      colWidths: [4, 28, 10, 26, 16],
    });

    coins.forEach((coin, idx) => {
      table.push([
        chalk.dim(idx + 1),
        chalk.white.bold(coin.name),
        chalk.dim(coin.symbol.toUpperCase()),
        chalk.cyan(coin.id),
        coin.market_cap_rank ? chalk.yellow(`#${coin.market_cap_rank}`) : chalk.dim('—'),
      ]);
    });

    console.log(table.toString());
    console.log(chalk.dim(`  ${coins.length} result(s) for "${query}"\n`));
  });

// ─── whoami / status ──────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show current auth configuration')
  .action(() => {
    printBanner();
    const apiKey = config.get('apiKey');
    const tier   = config.get('tier') || 'demo';

    if (!apiKey) {
      console.log(chalk.yellow('  ⚠  No credentials configured.'));
      console.log(chalk.dim('     Run: coingecko auth\n'));
    } else {
      console.log(chalk.green.bold('  ✔  Credentials configured'));
      console.log(chalk.dim(`     Tier : ${tier}`));
      console.log(chalk.dim(`     Key  : ${apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, apiKey.length - 6))}\n`));
    }
  });

program.parse(process.argv);
