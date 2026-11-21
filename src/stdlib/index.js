import fs from 'node:fs';
import path from 'node:path';

export const STRING_METHODS = {
  besar: (s) => s.toUpperCase(),
  kecil: (s) => s.toLowerCase(),
  panjang: (s) => s.length,
  potong: (s) => s.trim(),
  ganti: (s, a, b) => s.split(a).join(b),
  pisah: (s, sep) => s.split(sep),
  mengandung: (s, sub) => s.includes(sub),
  mulai: (s, x) => s.startsWith(x),
  selesai: (s, x) => s.endsWith(x),
  ulang: (s, n) => s.repeat(n),
  ambil: (s, a, b) => s.slice(a, b),
};

export const ARRAY_METHODS = {
  tambah: function (x) { this.push(x); return null; },
  hapus: function (x) {
    const i = this.indexOf(x);
    if (i >= 0) this.splice(i, 1);
    return null;
  },
  panjang: function () { return this.length; },
  urutkan: function () { this.sort(); return null; },
  balik: function () { this.reverse(); return null; },
  gabung: function (sep = '') { return this.join(sep); },
  peta: async function (fn) { const r = []; for (const x of this) r.push(await fn(x)); return r; },
  saring: async function (fn) { const r = []; for (const x of this) if (await fn(x)) r.push(x); return r; },
  cari: function (fn) { return this.find(fn); },
  indeks: function (x) { return this.indexOf(x); },
  punya: function (x) { return this.includes(x); },
};

export function installStdlib(interp) {
  const g = interp.global;

  g.define('tampilkan', (...args) => {
    interp.outputFn(args.map((a) => interp.formatValue(a, true)).join(' '));
    return null;
  });

  g.define('masukan', (prompt = '') => interp.inputFn(prompt));

  g.define('teks', {
    panjang: (s) => String(s).length,
    besar: (s) => String(s).toUpperCase(),
    kecil: (s) => String(s).toLowerCase(),
    ganti: (s, a, b) => String(s).split(a).join(b),
    potong: (s) => String(s).trim(),
    pisah: (s, sep) => String(s).split(sep),
    gabung: (arr, sep = '') => arr.join(sep),
    mengandung: (s, x) => String(s).includes(x),
  });

  g.define('angka', {
    bulat: (x) => Math.round(x),
    bawah: (x) => Math.floor(x),
    atas: (x) => Math.ceil(x),
    acak: () => Math.random(),
    maks: (...a) => Math.max(...a),
    min: (...a) => Math.min(...a),
    mutlak: (x) => Math.abs(x),
    teks: (x) => String(x),
    parse: (s) => Number(s),
  });

  g.define('daftar', {
    panjang: (arr) => arr.length,
    urutkan: (arr) => [...arr].sort(),
    balik: (arr) => [...arr].reverse(),
    gabung: (arr, sep = '') => arr.join(sep),
    salin: (arr) => [...arr],
  });

  g.define('waktu', {
    sekarang: () => Date.now(),
    tidur: (ms) => new Promise((r) => setTimeout(r, ms)),
    format: (ms, loc = 'id-ID') => new Date(ms).toLocaleString(loc),
  });

  g.define('berkas', {
    baca: (p) => fs.readFileSync(p, 'utf8'),
    tulis: (p, d) => { fs.writeFileSync(p, d, 'utf8'); return null; },
    hapus: (p) => { fs.unlinkSync(p); return null; },
    ada: (p) => fs.existsSync(p),
    daftar: (p) => fs.readdirSync(p),
  });

  g.define('sistem', {
    platform: () => process.platform,
    cwd: () => process.cwd(),
    env: (k) => process.env[k],
    keluar: (code = 0) => process.exit(code),
    argumen: () => process.argv.slice(2),
  });

  g.define('json', {
    parse: (s) => JSON.parse(s),
    stringify: (v, indent = 0) => JSON.stringify(v, null, indent),
  });

  g.define('matematika', {
    pi: Math.PI,
    e: Math.E,
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    tan: (x) => Math.tan(x),
    sqrt: (x) => Math.sqrt(x),
    pow: (a, b) => Math.pow(a, b),
    log: (x) => Math.log(x),
  });

  g.define('http', {
    get: async (url) => {
      const r = await fetch(url);
      const text = await r.text();
      return { status: r.status, teks: text, ok: r.ok };
    },
    post: async (url, body) => {
      const r = await fetch(url, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
      return { status: r.status, teks: await r.text(), ok: r.ok };
    },
    put: async (url, body) => {
      const r = await fetch(url, { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) });
      return { status: r.status, teks: await r.text(), ok: r.ok };
    },
    hapus: async (url) => {
      const r = await fetch(url, { method: 'DELETE' });
      return { status: r.status, teks: await r.text(), ok: r.ok };
    },
  });
}
