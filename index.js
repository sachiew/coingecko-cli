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

// ─── CSV Export Helper ────────────────────────────────────────────────────────
function exportCSV(rows, fields, filename) {
  const parser = new Parser({ fields });
  const csv    = parser.parse(rows);
  writeFileSync(filename, csv);
  console.log(chalk.green(`✅ Data exported to ${filename}\n`));
}

// ─── Chart Data Display + Export Helper ──────────────────────────────────────
function displayAndExportChartData(data, id, currency, exportFile) {
  const prices = data.prices || [];

  if (!prices.length) {
    console.error(chalk.red('  ✖  No price data returned.'));
    process.exit(1);
  }

  const rows = prices.map((entry, i) => {
    const ts = entry[0];
    const dt = new Date(ts);
    const datetime = dt.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    return {
      datetime,
      price:        entry[1],
      market_cap:   data.market_caps?.[i]?.[1] ?? null,
      total_volume: data.total_volumes?.[i]?.[1] ?? null,
    };
  });

  const DISPLAY_LIMIT = 50;
  const showRows = rows.length > DISPLAY_LIMIT ? rows.slice(-DISPLAY_LIMIT) : rows;

  if (rows.length > DISPLAY_LIMIT) {
    console.log(
      dim(`  Showing last ${DISPLAY_LIMIT} of ${rows.length} data points.`) +
      ' Use ' + green('--export') + dim(' for the full dataset.\n')
    );
  }

  const table = new Table({
    head: [
      green.bold('Date / Time (UTC)'),
      green.bold(`Price (${currency.toUpperCase()})`),
      green.bold('Market Cap'),
      green.bold('24h Volume'),
    ],
    style:     { head: [], border: ['dim'] },
    colAligns: ['left', 'right', 'right', 'right'],
    colWidths: [22, 20, 16, 16],
  });

  for (const row of showRows) {
    table.push([
      chalk.white(row.datetime),
      chalk.white(formatUSD(row.price)),
      dim(formatLargeUSD(row.market_cap)),
      dim(formatLargeUSD(row.total_volume)),
    ]);
  }

  console.log(table.toString());
  console.log(dim(
    `  ${rows.length} data points  •  ${id} vs ${currency.toUpperCase()}  •  ${new Date().toLocaleTimeString()}\n`
  ));

  if (exportFile) {
    exportCSV(rows, ['datetime', 'price', 'market_cap', 'total_volume'], exportFile);
  }
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
  const separator = dim('─'.repeat(48));

  const body = [
    subtitle,
    '',
    separator,
    '',
    dim('Quick Start'),
    '',
    `  ${green('$')} cg auth                        ${dim('# Set up your API key')}`,
    `  ${green('$')} cg price --ids bitcoin          ${dim('# Get BTC price')}`,
    `  ${green('$')} cg markets --total 100          ${dim('# Top 100 by market cap')}`,
    `  ${green('$')} cg search ethereum              ${dim('# Search for a coin')}`,
    `  ${green('$')} cg trending                     ${dim('# Trending coins, NFTs & categories')}`,
    `  ${green('$')} cg history bitcoin --days 30    ${dim('# 30-day price history')}`,
    `  ${green('$')} cg history bitcoin --date 2024-01-01  ${dim('# Snapshot')}`,
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
  .version('1.2.0', '-v, --version')
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
      exportCSV(allCoins, fields, opts.export);
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

// ─── TRENDING ─────────────────────────────────────────────────────────────────
program
  .command('trending')
  .description('Show trending coins, NFTs, and categories on CoinGecko (24h)')
  .action(async () => {
    printBanner();
    console.log(dim('  Fetching trending data...\n'));

    const data = await makeRequest('/search/trending');

    // ── Top 15 Trending Coins ───────────────────────────────────────────────
    const coins = (data.coins || []).slice(0, 15);
    if (coins.length) {
      const coinTable = new Table({
        head: [
          green.bold('#'),
          green.bold('Coin'),
          green.bold('Symbol'),
          green.bold('Rank'),
          green.bold('Price (USD)'),
          green.bold('24h Change'),
        ],
        style:     { head: [], border: ['dim'] },
        colAligns: ['right', 'left', 'left', 'right', 'right', 'right'],
        colWidths: [4, 24, 10, 8, 18, 14],
      });

      coins.forEach((entry, idx) => {
        const item    = entry.item;
        const price   = item.data?.price;
        const change  = item.data?.price_change_percentage_24h?.usd;

        // The API returns price as a pre-formatted string (e.g. "$0.00345")
        const priceDisplay = price != null
          ? (typeof price === 'number' ? chalk.white(formatUSD(price)) : chalk.white(String(price)))
          : dim('N/A');

        coinTable.push([
          dim(idx + 1),
          chalk.white.bold(item.name),
          dim(item.symbol?.toUpperCase() ?? '—'),
          item.market_cap_rank ? yellow(`#${item.market_cap_rank}`) : dim('—'),
          priceDisplay,
          formatChange(change),
        ]);
      });

      console.log(green.bold('  ▸ Top 15 Trending Coins'));
      console.log(coinTable.toString());
    }

    // ── Top 7 Trending NFTs ─────────────────────────────────────────────────
    const nfts = (data.nfts || []).slice(0, 7);
    if (nfts.length) {
      const nftTable = new Table({
        head: [
          green.bold('#'),
          green.bold('NFT Collection'),
          green.bold('Symbol'),
          green.bold('Floor Price'),
          green.bold('24h Change'),
        ],
        style:     { head: [], border: ['dim'] },
        colAligns: ['right', 'left', 'left', 'right', 'right'],
        colWidths: [4, 30, 10, 18, 14],
      });

      nfts.forEach((nft, idx) => {
        const change     = nft.data?.price_change_percentage_24h?.usd;
        const floorPrice = nft.data?.floor_price ?? nft.floor_price_in_native_currency ?? null;

        nftTable.push([
          dim(idx + 1),
          chalk.white.bold(nft.name),
          dim(nft.symbol?.toUpperCase() ?? '—'),
          floorPrice != null ? chalk.white(String(floorPrice)) : dim('N/A'),
          formatChange(change),
        ]);
      });

      console.log(green.bold('\n  ▸ Top 7 Trending NFTs'));
      console.log(nftTable.toString());
    }

    // ── Top 6 Trending Categories ───────────────────────────────────────────
    const categories = (data.categories || []).slice(0, 6);
    if (categories.length) {
      const catTable = new Table({
        head: [
          green.bold('#'),
          green.bold('Category'),
          green.bold('Coins'),
          green.bold('Market Cap'),
          green.bold('24h Change'),
        ],
        style:     { head: [], border: ['dim'] },
        colAligns: ['right', 'left', 'right', 'right', 'right'],
        colWidths: [4, 34, 8, 16, 14],
      });

      categories.forEach((cat, idx) => {
        const change = cat.data?.market_cap_change_percentage_24h?.usd;

        catTable.push([
          dim(idx + 1),
          chalk.white.bold(cat.name),
          dim(cat.coins_count ?? '—'),
          cat.data?.market_cap ? dim(formatLargeUSD(cat.data.market_cap)) : dim('N/A'),
          formatChange(change),
        ]);
      });

      console.log(green.bold('\n  ▸ Top 6 Trending Categories'));
      console.log(catTable.toString());
    }

    console.log(dim(`\n  Trending data from CoinGecko  •  ${new Date().toLocaleTimeString()}\n`));
  });

// ─── HISTORY ─────────────────────────────────────────────────────────────────
program
  .command('history <id>')
  .description('Get historical price data for a coin')
  .option('--date <YYYY-MM-DD>',  'Single date snapshot via /coins/{id}/history')
  .option('--days <n>',           'Relative days back via /coins/{id}/market_chart')
  .option('--from <YYYY-MM-DD>',  'Range start date via /coins/{id}/market_chart/range')
  .option('--to <YYYY-MM-DD>',    'Range end date via /coins/{id}/market_chart/range')
  .option('--vs <currency>',      'vs currency', 'usd')
  .option('--export <file>',      'Export data to a CSV file')
  .action(async (id, opts) => {
    printBanner();

    const currency = opts.vs;

    // ── Case A: Single Date Snapshot ─────────────────────────────────────────
    if (opts.date) {
      const [year, month, day] = opts.date.split('-');
      if (!year || !month || !day) {
        console.error(chalk.red('  ✖  Invalid date format. Use YYYY-MM-DD (e.g. 2024-01-15)'));
        process.exit(1);
      }
      const apiDate = `${day}-${month}-${year}`;  // API expects DD-MM-YYYY

      console.log(dim(`  Fetching snapshot for ${chalk.white(id)} on ${chalk.white(opts.date)}...\n`));

      const data = await makeRequest(`/coins/${id}/history`, {
        date:         apiDate,
        localization: false,
      });

      if (!data.market_data) {
        console.error(chalk.red(`  ✖  No market data found for "${id}" on ${opts.date}.`));
        console.error(dim('     The coin may not have existed yet, or data is unavailable for this date.'));
        process.exit(1);
      }

      const price  = data.market_data.current_price?.[currency];
      const cap    = data.market_data.market_cap?.[currency];
      const vol    = data.market_data.total_volume?.[currency];

      const table = new Table({
        head: [
          green.bold('Coin'),
          green.bold('Date'),
          green.bold(`Price (${currency.toUpperCase()})`),
          green.bold('Market Cap'),
          green.bold('24h Volume'),
        ],
        style:     { head: [], border: ['dim'] },
        colAligns: ['left', 'left', 'right', 'right', 'right'],
        colWidths: [20, 14, 20, 16, 16],
      });

      table.push([
        chalk.white.bold(data.name),
        chalk.white(opts.date),
        chalk.white(formatUSD(price)),
        dim(formatLargeUSD(cap)),
        dim(formatLargeUSD(vol)),
      ]);

      console.log(table.toString());
      console.log(dim(`  Data from CoinGecko  •  ${new Date().toLocaleTimeString()}\n`));

      if (opts.export) {
        exportCSV(
          [{ date: opts.date, price, market_cap: cap, total_volume: vol }],
          ['date', 'price', 'market_cap', 'total_volume'],
          opts.export
        );
      }
      return;
    }

    // ── Case B: Relative Days ─────────────────────────────────────────────────
    if (opts.days) {
      const days = parseInt(opts.days, 10);
      if (isNaN(days) || days < 1) {
        console.error(chalk.red('  ✖  --days must be a positive integer.'));
        process.exit(1);
      }

      console.log(dim(`  Fetching ${days}-day market chart for ${chalk.white(id)}...\n`));

      const data = await makeRequest(`/coins/${id}/market_chart`, {
        vs_currency: currency,
        days,
      });

      displayAndExportChartData(data, id, currency, opts.export);
      return;
    }

    // ── Case C: Date Range ────────────────────────────────────────────────────
    if (opts.from && opts.to) {
      const fromMs = new Date(opts.from).getTime();
      const toMs   = new Date(opts.to).getTime();

      if (isNaN(fromMs) || isNaN(toMs)) {
        console.error(chalk.red('  ✖  Invalid date format. Use YYYY-MM-DD for --from and --to.'));
        process.exit(1);
      }
      if (fromMs >= toMs) {
        console.error(chalk.red('  ✖  --from must be earlier than --to.'));
        process.exit(1);
      }

      const fromTs   = Math.floor(fromMs / 1000);
      const toTs     = Math.floor(toMs   / 1000);
      const diffDays = (toTs - fromTs) / 86400;

      console.log(dim(`  Fetching market chart for ${chalk.white(id)} from ${chalk.white(opts.from)} to ${chalk.white(opts.to)}...\n`));

      let prices = [], marketCaps = [], totalVolumes = [];

      if (diffDays > 90) {
        // ── Chunked fetch: stitch 90-day segments ──────────────────────────
        const totalChunks = Math.ceil(diffDays / 90);
        console.log(dim(`  Range is ${Math.round(diffDays)} days — fetching in ${totalChunks} chunks of ≤90 days...\n`));

        let chunkFrom = fromTs;
        let chunkIdx  = 0;

        while (chunkFrom < toTs) {
          chunkIdx++;
          const chunkTo = Math.min(chunkFrom + 90 * 86400, toTs);

          process.stdout.write(
            dim(`  ◌ Fetching chunk ${chunkIdx} of ${totalChunks} (${new Date(chunkFrom * 1000).toISOString().slice(0, 10)} → ${new Date(chunkTo * 1000).toISOString().slice(0, 10)})...`) + '\r'
          );

          const chunk = await makeRequest(`/coins/${id}/market_chart/range`, {
            vs_currency: currency,
            from:        chunkFrom,
            to:          chunkTo,
          });

          prices       = prices.concat(chunk.prices       || []);
          marketCaps   = marketCaps.concat(chunk.market_caps   || []);
          totalVolumes = totalVolumes.concat(chunk.total_volumes || []);

          chunkFrom = chunkTo + 1;
        }

        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        console.log(chalk.green.bold(`  ✔  Stitched ${totalChunks} chunks into ${prices.length} data points\n`));

      } else {
        // ── Single fetch ───────────────────────────────────────────────────
        const data = await makeRequest(`/coins/${id}/market_chart/range`, {
          vs_currency: currency,
          from:        fromTs,
          to:          toTs,
        });

        prices       = data.prices       || [];
        marketCaps   = data.market_caps   || [];
        totalVolumes = data.total_volumes || [];
      }

      displayAndExportChartData(
        { prices, market_caps: marketCaps, total_volumes: totalVolumes },
        id,
        currency,
        opts.export
      );
      return;
    }

    // ── No valid option provided ──────────────────────────────────────────────
    console.error(chalk.red('  ✖  Please provide one of:'));
    console.error(dim('       --date YYYY-MM-DD         (single snapshot)'));
    console.error(dim('       --days <n>                (relative days back)'));
    console.error(dim('       --from YYYY-MM-DD --to YYYY-MM-DD  (date range)'));
    process.exit(1);
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
