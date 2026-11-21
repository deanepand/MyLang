import { test } from 'node:test';
import assert from 'node:assert';
import { Interpreter } from '../src/interpreter/interpreter.js';

async function run(src) {
  const out = [];
  const interp = new Interpreter({ output: (s) => out.push(s), input: () => 'dummy' });
  await interp.runSource(src, '<test>');
  return { out, interp };
}

test('arithmetic', async () => {
  const { out } = await run('tampilkan(1 + 2 * 3)');
  assert.deepEqual(out, ['7']);
});

test('variables and reassignment', async () => {
  const { out } = await run('x = 5\nx = x + 3\ntampilkan(x)');
  assert.deepEqual(out, ['8']);
});

test('if/else', async () => {
  const { out } = await run('jika 10 > 5 { tampilkan("ya") } selain { tampilkan("tidak") }');
  assert.deepEqual(out, ['ya']);
});

test('for loop', async () => {
  const { out } = await run('untuk i dari 1 sampai 3 { tampilkan(i) }');
  assert.deepEqual(out, ['1', '2', '3']);
});

test('while loop with break', async () => {
  const { out } = await run('n = 0\nselama benar { n += 1\n jika n >= 3 { berhenti }\n tampilkan(n) }');
  assert.deepEqual(out, ['1', '2']);
});

test('function and return', async () => {
  const { out } = await run('fungsi tambah(a, b) { kembalikan a + b }\ntampilkan(tambah(10, 20))');
  assert.deepEqual(out, ['30']);
});

test('recursive function', async () => {
  const { out } = await run('fungsi f(n) { jika n <= 1 { kembalikan 1 }\n kembalikan n * f(n-1) }\ntampilkan(f(5))');
  assert.deepEqual(out, ['120']);
});

test('array operations', async () => {
  const { out } = await run('a = [1, 2, 3]\na.tambah(4)\ntampilkan(a[3])\ntampilkan(a.panjang())');
  assert.deepEqual(out, ['4', '4']);
});

test('object', async () => {
  const { out } = await run('u = { nama: "Epann", umur: 17 }\ntampilkan(u.nama)\nu.umur = 20\ntampilkan(u.umur)');
  assert.deepEqual(out, ['Epann', '20']);
});

test('string interpolation', async () => {
  const { out } = await run('nama = "Epann"\ntampilkan("Halo, {nama}!")');
  assert.deepEqual(out, ['Halo, Epann!']);
});

test('class and inheritance', async () => {
  const { out } = await run(`
kelas A {
    fungsi buat(x) { diri.x = x }
    fungsi info() { tampilkan("A:" + diri.x) }
}
kelas B dari A {
    fungsi buat(x, y) { induk.buat(x); diri.y = y }
    fungsi info() { induk.info(); tampilkan("B:" + diri.y) }
}
b = B(1, 2)
b.info()
`);
  assert.deepEqual(out, ['A:1', 'B:2']);
});

test('try/catch', async () => {
  const { out } = await run('coba { lemparkan "gagal" } tangkap error { tampilkan("caught: " + error.message) }');
  assert.deepEqual(out, ['caught: gagal']);
});

test('assertion', async () => {
  await assert.rejects(async () => {
    await run('pastikan 1 == 2');
  });
});

test('boolean and logical', async () => {
  const { out } = await run('tampilkan(benar dan salah)\ntampilkan(benar atau salah)\ntampilkan(bukan benar)');
  assert.deepEqual(out, ['salah', 'benar', 'salah']);
});
