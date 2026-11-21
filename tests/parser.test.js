import { test } from 'node:test';
import assert from 'node:assert';
import { Lexer } from '../src/compiler/lexer.js';
import { Parser } from '../src/compiler/parser.js';

function parse(src) {
  return new Parser(new Lexer(src).tokenize()).parse();
}

test('parse var decl', () => {
  const ast = parse('x = 1');
  assert.equal(ast.body[0].type, 'ExprStmt');
  assert.equal(ast.body[0].expression.type, 'Assignment');
});

test('parse fungsi', () => {
  const ast = parse('fungsi tambah(a, b) { kembalikan a + b }');
  assert.equal(ast.body[0].type, 'FunctionDecl');
  assert.equal(ast.body[0].name, 'tambah');
  assert.equal(ast.body[0].params.length, 2);
});

test('operator precedence', () => {
  const ast = parse('x = 1 + 2 * 3');
  // x = (1 + (2 * 3))
  const bin = ast.body[0].expression.value;
  assert.equal(bin.operator, '+');
  assert.equal(bin.right.operator, '*');
});

test('parse jika/selain', () => {
  const ast = parse('jika x > 5 { tampilkan("besar") } selain { tampilkan("kecil") }');
  assert.equal(ast.body[0].type, 'IfStmt');
  assert.ok(ast.body[0].alternate);
});
