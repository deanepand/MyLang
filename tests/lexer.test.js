import { test } from 'node:test';
import assert from 'node:assert';
import { Lexer } from '../src/compiler/lexer.js';

test('tokenize simple program', () => {
  const tokens = new Lexer('tampilkan("halo")').tokenize();
  assert.equal(tokens[0].type, 'IDENTIFIER');
  assert.equal(tokens[0].value, 'tampilkan');
  assert.equal(tokens[1].value, '(');
  assert.equal(tokens[2].type, 'STRING');
  assert.equal(tokens[2].value, 'halo');
});

test('tokenize numbers and operators', () => {
  const tokens = new Lexer('a = 1 + 2.5 * 3').tokenize();
  assert.equal(tokens[0].type, 'IDENTIFIER');
  assert.equal(tokens[1].value, '=');
  assert.equal(tokens[2].value, 1);
  assert.equal(tokens[3].value, '+');
  assert.equal(tokens[4].value, 2.5);
});

test('comments ignored', () => {
  const tokens = new Lexer('// komentar\na = 1').tokenize();
  assert.equal(tokens[0].value, 'a');
});
