import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Lexer } from '../compiler/lexer.js';
import { Parser } from '../compiler/parser.js';
import { Interpreter } from '../interpreter/interpreter.js';

const VERSION = '1.0.0';
const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m';

export async function runCli(argv) {
  const args = argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === '-h') return printHelp();
  if (cmd === '--version' || cmd === '-v') return console.log(`MyLang v${VERSION}`);

  switch (cmd) {
    case 'run': return runFile(args[1]);
    case 'check': return checkFile(args[1]);
    case 'init': return initProject(args[1]);
    case 'repl': return runRepl();
    case 'fmt': return fmtFile(args[1]);
    case 'watch': return watchFile(args[1]);
    case 'test': return runTests();
    case 'install': return packageInstall(args[1]);
    case 'list': return packageList();
    case 'build': return buildProject(args[1]);
    default:
      console.error(`${RED}Perintah tidak dikenal:${RESET} ${cmd}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`MyLang v${VERSION} — Kode Lebih Mudah, Logika Lebih Dekat.

Penggunaan:
  my <perintah> [argumen]

Perintah:
  run <file.mylang>      Jalankan file MyLang
  check <file.mylang>    Periksa sintaks dan semantik
  init [nama]            Buat project MyLang baru
  repl                   Interactive shell
  fmt <file.mylang>      Rapikan format kode
  watch <file.mylang>    Jalankan ulang saat file berubah
  build <file.mylang>    Buat artifact build
  test                   Jalankan test project
  install <paket>        Pasang dependency
  list                   Tampilkan dependency

Opsi:
  --version, -v          Tampilkan versi
  --help, -h             Tampilkan bantuan

Developer: EpannXD`);
}

async function runFile(file) {
  if (!file) { console.error(`${RED}Gunakan:${RESET} my run <file.mylang>`); process.exit(1); }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) { console.error(`${RED}File tidak ditemukan:${RESET} ${file}`); process.exit(1); }
  const src = fs.readFileSync(abs, 'utf8');
  try {
    const interp = new Interpreter({ currentDir: path.dirname(abs) });
    await interp.runSource(src, abs);
  } catch (e) {
    console.error(formatError(e, src, abs));
    process.exit(1);
  }
}

async function checkFile(file) {
  if (!file) { console.error(`${RED}Gunakan:${RESET} my check <file.mylang>`); process.exit(1); }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) { console.error(`${RED}File tidak ditemukan:${RESET} ${file}`); process.exit(1); }
  const src = fs.readFileSync(abs, 'utf8');
  try {
    const tokens = new Lexer(src, abs).tokenize();
    new Parser(tokens, abs).parse();
    console.log(`${GREEN}✓${RESET} Tidak ada error sintaks di ${file}`);
  } catch (e) {
    console.error(formatError(e, src, abs));
    process.exit(1);
  }
}

function formatError(e, source, filename) {
  const lines = [];
  lines.push(`${RED}${e.name || 'Error'}${RESET}: ${e.message}`);
  if (e.line) {
    lines.push(`  ${CYAN}→${RESET} ${filename}:${e.line}:${e.col || 1}`);
    if (source) {
      const srcLines = source.split('\n');
      const start = Math.max(0, e.line - 3);
      const end = Math.min(srcLines.length, e.line + 2);
      for (let i = start; i < end; i++) {
        const marker = i + 1 === e.line ? `${RED}>${RESET}` : ' ';
        lines.push(`${marker} ${String(i + 1).padStart(3)} | ${srcLines[i]}`);
        if (i + 1 === e.line && e.col) {
          lines.push(`    | ${' '.repeat(e.col - 1)}${RED}^${RESET}`);
        }
      }
    }
  }
  return lines.join('\n');
}

async function runRepl() {
  console.log(`${CYAN}MyLang Interactive Shell v${VERSION}${RESET}`);
  console.log(`Developed by EpannXD`);
  console.log(`Ketik 'keluar' untuk keluar, 'bantuan' untuk bantuan.\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'my> ' });
  const interp = new Interpreter({ currentDir: process.cwd() });

  const ask = () => new Promise((r) => rl.question('my> ', r));
  while (true) {
    let line;
    try { line = await ask(); } catch { break; }
    const trimmed = line.trim();
    if (['keluar', 'exit', '.exit', 'quit'].includes(trimmed)) break;
    if (['bantuan', 'help'].includes(trimmed)) {
      console.log('Perintah REPL: keluar, bantuan');
      continue;
    }
    if (!trimmed) continue;
    try {
      const tokens = new Lexer(trimmed, '<repl>').tokenize();
      const ast = new Parser(tokens, '<repl>').parse();
      const result = await interp.evaluate(ast, interp.global);
      if (result !== null && result !== undefined) console.log(interp.formatValue(result, true));
    } catch (e) {
      console.error(`${RED}${e.name || 'Error'}${RESET}: ${e.message}`);
    }
  }
  rl.close();
  console.log('Sampai jumpa!');
}

async function initProject(name) {
  const folder = name || 'aplikasi-mylang';
  if (fs.existsSync(folder)) { console.error(`${RED}Folder '${folder}' sudah ada${RESET}`); process.exit(1); }
  fs.mkdirSync(folder);
  const pkg = {
    nama: folder, versi: '1.0.0', pengembang: 'EpannXD',
    fileUtama: 'main.mylang',
    skrip: { mulai: 'my run main.mylang' },
    dependensi: {},
  };
  fs.writeFileSync(path.join(folder, 'mylang.json'), JSON.stringify(pkg, null, 2));
  fs.writeFileSync(path.join(folder, 'main.mylang'),
`// Program MyLang pertama

tampilkan("Halo Dunia!")

nama = "Epann"
umur = 17
tampilkan("Nama: " + nama)
tampilkan("Umur: " + umur)
`);
  console.log(`${GREEN}✓${RESET} Project dibuat di '${folder}'`);
  console.log(`  ${CYAN}cd ${folder} && my run main.mylang${RESET}`);
}

async function fmtFile(file) {
  if (!file) { console.error(`${RED}Gunakan:${RESET} my fmt <file.mylang>`); process.exit(1); }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) { console.error(`${RED}File tidak ditemukan:${RESET} ${file}`); process.exit(1); }
  // Very basic formatter: normalizes spacing & indentation for common cases.
  const src = fs.readFileSync(abs, 'utf8');
  let formatted = src.split('\n').map((line) => {
    let l = line.replace(/\s+$/, '');
    // basic spacing around operators
    l = l.replace(/\s*=\s*/g, ' = ').replace(/\s*\+\s*/g, ' + ').replace(/\s*,\s*/g, ', ');
    return l;
  }).join('\n');
  fs.writeFileSync(abs, formatted);
  console.log(`${GREEN}✓${RESET} ${file} diformat`);
}

async function watchFile(file) {
  if (!file) { console.error(`${RED}Gunakan:${RESET} my watch <file.mylang>`); process.exit(1); }
  const abs = path.resolve(file);
  console.log(`${YELLOW}⌚ Watching ${file}...${RESET}`);
  const run = async () => {
    const src = fs.readFileSync(abs, 'utf8');
    try {
      const interp = new Interpreter({ currentDir: path.dirname(abs) });
      await interp.runSource(src, abs);
    } catch (e) { console.error(formatError(e, src, abs)); }
  };
  await run();
  fs.watch(abs, { persistent: true }, async () => { console.log(`\n${YELLOW}↻ File berubah, menjalankan ulang...${RESET}`); await run(); });
}

async function runTests() {
  const testDir = path.resolve('tests');
  const files = fs.existsSync(testDir)
    ? fs.readdirSync(testDir).filter((f) => f.endsWith('.mylang')).map((f) => path.join(testDir, f))
    : [];
  if (files.length === 0) { console.log(`${YELLOW}Tidak ada file test ditemukan di tests/${RESET}`); return; }
  let pass = 0, fail = 0;
  for (const f of files) {
    try {
      const interp = new Interpreter({ currentDir: path.dirname(f) });
      await interp.runSource(fs.readFileSync(f, 'utf8'), f);
      console.log(`${GREEN}✓${RESET} ${path.basename(f)}`);
      pass++;
    } catch (e) {
      console.log(`${RED}✗${RESET} ${path.basename(f)}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\n${pass} lulus, ${fail} gagal`);
  if (fail > 0) process.exit(1);
}

async function packageInstall(name) {
  if (!name) { console.error(`${RED}Gunakan:${RESET} my install <paket>`); process.exit(1); }
  const pkgFile = path.resolve('mylang.json');
  if (!fs.existsSync(pkgFile)) { console.error(`${RED}mylang.json tidak ditemukan. Jalankan 'my init' dulu.${RESET}`); process.exit(1); }
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  pkg.dependensi = pkg.dependensi || {};
  pkg.dependensi[name] = '^1.0.0';
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));
  console.log(`${GREEN}✓${RESET} '${name}' ditambahkan ke dependensi (registry lokal)`);
}

async function packageList() {
  const pkgFile = path.resolve('mylang.json');
  if (!fs.existsSync(pkgFile)) { console.log('Tidak ada mylang.json'); return; }
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  const deps = pkg.dependensi || {};
  const keys = Object.keys(deps);
  if (keys.length === 0) { console.log('(tidak ada dependensi)'); return; }
  for (const k of keys) console.log(`${CYAN}${k}${RESET}@${deps[k]}`);
}

async function buildProject(file) {
  if (!file) file = 'main.mylang';
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) { console.error(`${RED}File tidak ditemukan:${RESET} ${file}`); process.exit(1); }
  const out = path.resolve('build', file.replace(/\.mylang$/, '.json'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const src = fs.readFileSync(abs, 'utf8');
  try {
    const tokens = new Lexer(src, abs).tokenize();
    const ast = new Parser(tokens, abs).parse();
    fs.writeFileSync(out, JSON.stringify({ version: VERSION, source: src, ast }, null, 2));
    console.log(`${GREEN}✓${RESET} Build disimpan ke ${out}`);
  } catch (e) { console.error(formatError(e, src, abs)); process.exit(1); }
}
