#!/usr/bin/env node

import { Command } from 'commander';
import axios from 'axios';
import Conf from 'conf';
import chalk from 'chalk';
import Table from 'cli-table3';
import readline from 'readline';
import boxen from 'boxen';
import { writeFileSync } from 'fs';
import { Parser } from 'json2csv';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const green  = chalk.hex('#8CC351');
const yellow = chalk.hex('#FFD700');
const dim    = chalk.dim;

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
        console.error(chalk.red('   Your API key is invalid or missing.'));
        console.error(dim('   Run: cg auth\n'));
      } else if (status === 429) {
        console.error(chalk.red.bold('\n✖  Rate Limit Exceeded (429)'));
        console.error(chalk.red('   You have hit the API rate limit.'));
        console.error(dim('   Wait a moment and try again, or upgrade your CoinGecko plan.\n'));
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
  if (value == null) return dim('N/A');
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(value);
}

function formatLargeUSD(value) {
  if (value == null) return dim('N/A');
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(2)}M`;
  return formatUSD(value);
}

function formatChange(value) {
  if (value == null) return dim('N/A');
  const fixed = value.toFixed(2) + '%';
  return value >= 0 ? chalk.green(`▲ ${fixed}`) : chalk.red(`▼ ${fixed}`);
}

// ─── ASCII Art Logo ───────────────────────────────────────────────────────────
function printLogo() {
  const logo = [
    '  ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ ███████╗ ██████╗██╗  ██╗ ██████╗ ',
    ' ██╔════╝██╔═══██╗██║████╗  ██║██╔════╝ ██╔════╝██╔════╝██║ ██╔╝██╔═══██╗',
    ' ██║     ██║   ██║██║██╔██╗ ██║██║  ███╗█████╗  ██║     █████╔╝ ██║   ██║',
    ' ██║     ██║   ██║██║██║╚██╗██║██║   ██║██╔══╝  ██║     ██╔═██╗ ██║   ██║',
    ' ╚██████╗╚██████╔╝██║██║ ╚████║╚██████╔╝███████╗╚██████╗██║  ██╗╚██████╔╝',
    '  ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝ ',
  ].join('\n');

  console.log('\n' + green(logo));
}

// ─── Welcome Box ─────────────────────────────────────────────────────────────
function printWelcomeBox() {
  const subtitle  = yellow.bold('Official API Command Line Interface');
  const separator = dim('─'.repeat(44));

  const body = [
    subtitle,
    '',
    separator,
    '',
    dim('Quick Start'),
    '',
    `  ${green('$')} cg auth                      ${dim('# Set up your API key')}`,
    `  ${green('$')} cg price --ids bitcoin        ${dim('# Get BTC price')}`,
    `  ${green('$')} cg markets --total 100        ${dim('# Top 100 by market cap')}`,
    `  ${green('$')} cg search ethereum            ${dim('# Search for a coin')}`,
    '',
    separator,
    '',
    dim('Docs: ') + chalk.cyan('https://docs.coingecko.com'),
  ].join('\n');

  const box = boxen(body, {
    padding: { top: 1, bottom: 1, left: 3, right: 3 },
    margin: { top: 0, bottom: 1, left: 1, right: 1 },
    borderStyle: 'round',
    borderColor: '#8CC351',
  });

  console.log(box);
}

// ─── Compact Banner (used on sub-commands) ────────────────────────────────────
function printBanner() {
  console.log(
    green.bold('\n  ◆ CoinGecko') +
    dim(' CLI  —  Real-time crypto data\n')
  );
}

// ─── Prompt Helper ────────────────────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function promptSelect(question, choices) {
  console.log(yellow.bold(`\n  ${question}`));
  choices.forEach((c, i) => console.log(`    ${dim(`${i + 1}.`)} ${c}`));
  const raw = await prompt(dim(`\n  Enter number [1-${choices.length}]: `));
  const idx = parseInt(raw, 10) - 1;
  if (idx < 0 || idx >= choices.length) return null;
  return choices[idx];
}

// ─── CLI Program ─────────────────────────────────────────────────────────────
const program = new Command();

program
  .name('coingecko')
  .description(
    green('CoinGecko CLI') + ' — real-time crypto data from the terminal\n\n' +
    dim('  Tip: ') + chalk.cyan('cg') + dim(' is the official shortcut for ') + chalk.cyan('coingecko') + dim(' — use it for faster access.')
  )
  .version('1.1.0', '-v, --version')
  .action(() => {
    // No sub-command → show full branded landing screen
    printLogo();
    printWelcomeBox();
  });

// ─── AUTH ─────────────────────────────────────────────────────────────────────
program
  .command('auth')
  .description('Save your CoinGecko API key and tier (demo/pro)')
  .option('--key <apiKey>', 'Your CoinGecko API key')
  .option('--tier <tier>', 'Your plan tier: demo or pro')
  .action(async (opts) => {
    printBanner();

    // ── Tier selection ──────────────────────────────────────────────────────
    let tier = opts.tier;
    if (!tier) {
      const choice = await promptSelect('Select your API tier:', ['demo  — Free tier (public API)', 'pro   — Paid tier (pro API)']);
      if (!choice) {
        console.error(chalk.red('\n  ✖  Invalid selection\n'));
        process.exit(1);
      }
      tier = choice.startsWith('demo') ? 'demo' : 'pro';
    }

    if (!['demo', 'pro'].includes(tier)) {
      console.error(chalk.red('  ✖  Tier must be "demo" or "pro"'));
      process.exit(1);
    }

    // ── API Key ─────────────────────────────────────────────────────────────
    let apiKey = opts.key;
    if (!apiKey) {
      console.log(
        '\n' +
        dim('  Get your free key at: ') +
        chalk.cyan('https://www.coingecko.com/en/api') + '\n'
      );
      apiKey = await prompt(yellow.bold('  Enter your API key: '));
    }

    if (!apiKey) {
      console.error(chalk.red('\n  ✖  API key cannot be empty\n'));
      process.exit(1);
    }

    config.set('apiKey', apiKey);
    config.set('tier', tier);

    const masked = apiKey.slice(0, 6) + '*'.repeat(Math.max(0, apiKey.length - 6));

    const saved = boxen(
      [
        chalk.green.bold('✔  Credentials saved'),
        '',
        `${yellow('Tier')}  ${tier}`,
        `${yellow('Key ')}  ${masked}`,
      ].join('\n'),
      {
        padding: { top: 0, bottom: 0, left: 2, right: 4 },
        margin: { top: 1, bottom: 1, left: 2, right: 0 },
        borderStyle: 'round',
        borderColor: '#8CC351',
      }
    );
    console.log(saved);
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

    if (opts.symbols) {
      const symbols = opts.symbols.split(',').map(s => s.trim().toLowerCase());
      console.log(dim(`  Resolving symbols: ${symbols.join(', ')}...\n`));

      const resolvedIds = [];
      for (const sym of symbols) {
        const result = await makeRequest('/search', { query: sym });
        const match = result.coins?.find(c => c.symbol.toLowerCase() === sym);
        if (match) {
          resolvedIds.push(match.id);
        } else {
          console.warn(chalk.red(`  ⚠  Symbol "${sym}" not found, skipping.`));
        }
      }

      if (!resolvedIds.length) {
        console.error(chalk.red('  ✖  No valid symbols resolved.'));
        process.exit(1);
      }
      coinIds = resolvedIds.join(',');
    }

    const ids          = coinIds.split(',').map(s => s.trim()).join(',');
    const vsCurrencies = opts.vs.split(',').map(s => s.trim()).join(',');

    console.log(dim(`  Fetching prices for: ${ids}\n`));

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
        yellow.bold('Coin'),
        ...currencies.map(c => yellow.bold(c.toUpperCase() + ' Price')),
        ...currencies.map(c => yellow.bold('24h Change (' + c.toUpperCase() + ')')),
      ],
      style: { head: [], border: ['dim'] },
      colAligns: ['left', ...currencies.map(() => 'right'), ...currencies.map(() => 'right')],
    });

    for (const [coinId, values] of Object.entries(data)) {
      table.push([
        chalk.white.bold(coinId),
        ...currencies.map(c => chalk.white(formatUSD(values[c]))),
        ...currencies.map(c => formatChange(values[`${c}_24h_change`])),
      ]);
    }

    console.log(table.toString());
    console.log(dim(`  Data from CoinGecko  •  ${new Date().toLocaleTimeString()}\n`));
  });

// ─── MARKETS ─────────────────────────────────────────────────────────────────
program
  .command('markets')
  .description('List top coins by market cap')
  .option('--total <n>',      'Total number of coins to fetch (max limited by plan)', '100')
  .option('--vs <currency>',  'vs currency', 'usd')
  .option('--order <order>',  'Sort order', 'market_cap_desc')
  .option('--export <file>',  'Export data to a CSV file')
  .action(async (opts) => {
    printBanner();

    const total    = Math.max(1, parseInt(opts.total, 10) || 100);
    const currency = opts.vs;
    const PER_PAGE = 250;

    const pagesNeeded = Math.ceil(total / PER_PAGE);

    if (pagesNeeded > 1) {
      console.log(
        green(`  Fetching ${total} coins across ${pagesNeeded} pages`) +
        dim(' (this may take a moment)...\n')
      );
    } else {
      console.log(dim(`  Fetching top ${total} coins by market cap...\n`));
    }

    let allCoins = [];
    const perPage = Math.min(PER_PAGE, total);

    for (let page = 1; page <= pagesNeeded; page++) {
      if (pagesNeeded > 1) {
        process.stdout.write(
          dim(`  ◌ Loading page ${page} of ${pagesNeeded}...`) + '\r'
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

      if (coins.length < perPage) break;
    }

    allCoins = allCoins.slice(0, total);

    if (pagesNeeded > 1) {
      process.stdout.write('\r' + ' '.repeat(60) + '\r');
    }

    if (!allCoins.length) {
      console.error(chalk.red('  ✖  No data returned.'));
      process.exit(1);
    }

    console.log(chalk.green.bold(`  ✔  Loaded ${allCoins.length} coins\n`));

    const table = new Table({
      head: [
        yellow.bold('#'),
        yellow.bold('Coin'),
        yellow.bold('Symbol'),
        yellow.bold(`Price (${currency.toUpperCase()})`),
        yellow.bold('24h Change'),
        yellow.bold('Market Cap'),
        yellow.bold('24h Volume'),
      ],
      style: { head: [], border: ['dim'] },
      colAligns: ['right', 'left', 'left', 'right', 'right', 'right', 'right'],
      colWidths: [5, 22, 8, 16, 12, 14, 14],
    });

    for (const coin of allCoins) {
      table.push([
        dim(coin.market_cap_rank ?? '—'),
        chalk.white.bold(coin.name),
        dim(coin.symbol.toUpperCase()),
        chalk.white(formatUSD(coin.current_price)),
        formatChange(coin.price_change_percentage_24h),
        dim(formatLargeUSD(coin.market_cap)),
        dim(formatLargeUSD(coin.total_volume)),
      ]);
    }

    console.log(table.toString());
    console.log(dim(`  ${allCoins.length} coins  •  vs ${currency.toUpperCase()}  •  ${new Date().toLocaleTimeString()}\n`));

    if (opts.export) {
      const fields = [
        { label: 'Rank',        value: 'market_cap_rank' },
        { label: 'Name',        value: 'name' },
        { label: 'Symbol',      value: 'symbol' },
        { label: 'Price',       value: 'current_price' },
        { label: '24h Change%', value: 'price_change_percentage_24h' },
        { label: 'Market Cap',  value: 'market_cap' },
        { label: '24h Volume',  value: 'total_volume' },
      ];
      const parser = new Parser({ fields });
      const csv = parser.parse(allCoins);
      writeFileSync(opts.export, csv);
      console.log(chalk.green(`✅ Data exported to ${opts.export}\n`));
    }
  });

// ─── SEARCH ──────────────────────────────────────────────────────────────────
program
  .command('search <query>')
  .description('Search for coins, exchanges, and categories')
  .option('--limit <n>', 'Max results to show', '10')
  .action(async (query, opts) => {
    printBanner();

    const limit = Math.max(1, parseInt(opts.limit, 10) || 10);
    console.log(dim(`  Searching for "${query}"...\n`));

    const data = await makeRequest('/search', { query });
    const coins = (data.coins || []).slice(0, limit);

    if (!coins.length) {
      console.log(chalk.red(`  No results found for "${query}".`));
      return;
    }

    const table = new Table({
      head: [
        yellow.bold('#'),
        yellow.bold('Name'),
        yellow.bold('Symbol'),
        yellow.bold('Coin ID'),
        yellow.bold('Market Cap Rank'),
      ],
      style: { head: [], border: ['dim'] },
      colAligns: ['right', 'left', 'left', 'left', 'right'],
      colWidths: [4, 28, 10, 26, 16],
    });

    coins.forEach((coin, idx) => {
      table.push([
        dim(idx + 1),
        chalk.white.bold(coin.name),
        dim(coin.symbol.toUpperCase()),
        green(coin.id),
        coin.market_cap_rank ? yellow(`#${coin.market_cap_rank}`) : dim('—'),
      ]);
    });

    console.log(table.toString());
    console.log(chalk.green.bold(`  ✔  ${coins.length} result(s) for "${query}"\n`));
  });

// ─── STATUS ───────────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show current auth configuration')
  .action(() => {
    printBanner();
    const apiKey = config.get('apiKey');
    const tier   = config.get('tier') || 'demo';

    if (!apiKey) {
      console.log(chalk.red('  ⚠  No credentials configured.'));
      console.log(dim('     Run: cg auth\n'));
    } else {
      const masked = apiKey.slice(0, 6) + '*'.repeat(Math.max(0, apiKey.length - 6));
      console.log(chalk.green.bold('  ✔  Credentials configured'));
      console.log(`     ${yellow('Tier')}  ${tier}`);
      console.log(`     ${yellow('Key ')}  ${masked}\n`);
    }
  });

program.parse(process.argv);
