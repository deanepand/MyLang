import fs from 'node:fs';
import path from 'node:path';
import { Lexer } from '../compiler/lexer.js';
import { Parser } from '../compiler/parser.js';
import { Environment } from './environment.js';
import { installStdlib, STRING_METHODS, ARRAY_METHODS } from '../stdlib/index.js';

class ReturnSignal { constructor(v) { this.value = v; } }
class BreakSignal {}
class ContinueSignal {}

export class Interpreter {
  constructor(opts = {}) {
    this.global = new Environment();
    this.currentDir = opts.currentDir || process.cwd();
    this.moduleCache = new Map();
    this.outputFn = opts.output ?? ((s) => process.stdout.write(s + '\n'));
    this.inputFn = opts.input ?? defaultInput;
    this.executionLimit = opts.executionLimit ?? 50_000_000;
    this.steps = 0;
    installStdlib(this);
  }

  async runSource(src, filename = '<input>') {
    const tokens = new Lexer(src, filename).tokenize();
    const ast = new Parser(tokens, filename).parse();
    await this.evaluate(ast, this.global);
    return this.global;
  }

  bump() {
    if (++this.steps > this.executionLimit) {
      const e = new Error(`Batas eksekusi terlampaui (${this.executionLimit} langkah)`);
      e.name = 'RuntimeError'; throw e;
    }
  }

  async evaluate(node, env) {
    this.bump();
    switch (node.type) {
      case 'Program': {
        for (const stmt of node.body) await this.execute(stmt, env);
        return null;
      }
      case 'Block': {
        const blockEnv = new Environment(env);
        for (const stmt of node.body) await this.execute(stmt, blockEnv);
        return null;
      }
      case 'VarDecl': {
        const val = await this.evaluate(node.value, env);
        env.define(node.name, val, node.constant);
        return null;
      }
      case 'Literal': return node.value;
      case 'Identifier': {
        if (!env.has(node.name)) {
          throw this.rtError(`Variabel '${node.name}' belum dideklarasikan`, node);
        }
        return env.get(node.name);
      }
      case 'This': {
        if (!env.has('diri')) throw this.rtError("'diri' hanya bisa dipakai di dalam kelas", node);
        return env.get('diri');
      }
      case 'Super': {
        if (!env.has('induk')) throw this.rtError("'induk' hanya bisa dipakai dalam kelas turunan", node);
        return env.get('induk');
      }
      case 'TemplateLiteral': {
        let s = '';
        for (const p of node.parts) {
          if (p.type === 'text') s += p.value;
          else {
            const subTokens = new Lexer(p.value).tokenize();
            const subAst = new Parser(subTokens).parse();
            if (subAst.body.length !== 1 || subAst.body[0].type !== 'ExprStmt') {
              throw this.rtError('Ekspresi interpolasi tidak valid', node);
            }
            const v = await this.evaluate(subAst.body[0].expression, env);
            s += this.formatValue(v, true);
          }
        }
        return s;
      }
      case 'ArrayLiteral': {
        const arr = [];
        for (const el of node.elements) arr.push(await this.evaluate(el, env));
        return arr;
      }
      case 'ObjectLiteral': {
        const obj = {};
        for (const p of node.properties) obj[p.key] = await this.evaluate(p.value, env);
        return obj;
      }
      case 'UnaryExpr': {
        const v = await this.evaluate(node.argument, env);
        if (node.operator === 'bukan') return !v;
        if (node.operator === '-') return -v;
        throw this.rtError(`Operator unary tidak dikenal: ${node.operator}`, node);
      }
      case 'BinaryExpr': return this.binary(node, env);
      case 'Assignment': return this.assignment(node, env);
      case 'MemberExpr': return this.member(node, env);
      case 'IndexExpr': {
        const obj = await this.evaluate(node.object, env);
        const idx = await this.evaluate(node.index, env);
        if (obj === null || obj === undefined) throw this.rtError('Tidak bisa mengakses indeks pada kosong', node);
        return obj[idx];
      }
      case 'CallExpr': return this.call(node, env);
      case 'FunctionExpr': return this.makeFunction(node, env);
      case 'AwaitExpr': return await this.evaluate(node.argument, env);
      case 'IfStmt': {
        if (await this.evaluate(node.condition, env)) await this.evaluate(node.consequent, env);
        else if (node.alternate) await this.evaluate(node.alternate, env);
        return null;
      }
      case 'ForStmt': return this.forLoop(node, env);
      case 'WhileStmt': return this.whileLoop(node, env);
      case 'BreakStmt': throw new BreakSignal();
      case 'ContinueStmt': throw new ContinueSignal();
      case 'ReturnStmt': {
        const v = node.argument ? await this.evaluate(node.argument, env) : null;
        throw new ReturnSignal(v);
      }
      case 'FunctionDecl': {
        if (!node.name) throw this.rtError('Deklarasi fungsi harus punya nama', node);
        const fn = this.makeFunction(node, env);
        env.define(node.name, fn);
        return null;
      }
      case 'SwitchStmt': return this.switchStmt(node, env);
      case 'TryStmt': return this.tryStmt(node, env);
      case 'AssertStmt': {
        const v = await this.evaluate(node.condition, env);
        if (!v) throw this.rtError('Pastikan gagal: kondisi tidak benar', node);
        return null;
      }
      case 'ThrowStmt': {
        const v = await this.evaluate(node.argument, env);
        const e = new Error(typeof v === 'string' ? v : this.formatValue(v));
        e.name = 'RuntimeError'; e.mylang = true; throw e;
      }
      case 'ClassDecl': return this.classDecl(node, env);
      case 'ImportDecl': return this.importDecl(node, env);
      case 'ExportDecl': {
        await this.execute(node.declaration, env);
        if (node.declaration.name) env.getExports()[node.declaration.name] = env.get(node.declaration.name);
        return null;
      }
      case 'ExportNames': {
        for (const name of node.names) env.getExports()[name] = env.get(name);
        return null;
      }
      case 'ExportDefault': {
        env.getExports().default = await this.evaluate(node.expression, env);
        return null;
      }
      case 'ExprStmt': return await this.evaluate(node.expression, env);
      default:
        throw this.rtError(`Node tidak dikenal: ${node.type}`, node);
    }
  }

  async execute(node, env) { return this.evaluate(node, env); }

  rtError(msg, node = {}) {
    const e = new Error(msg);
    e.name = 'RuntimeError'; e.line = node.line; e.col = node.col;
    e.mylang = true;
    return e;
  }

  async binary(node, env) {
    const op = node.operator;
    if (op === 'dan') return (await this.evaluate(node.left, env)) && (await this.evaluate(node.right, env));
    if (op === 'atau') return (await this.evaluate(node.left, env)) || (await this.evaluate(node.right, env));
    const a = await this.evaluate(node.left, env);
    const b = await this.evaluate(node.right, env);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? this.divZero(a) : a / b;
      case '%': return a % b;
      case '**': return a ** b;
      case '==': return a === b;
      case '!=': return a !== b;
      case '>': return a > b;
      case '<': return a < b;
      case '>=': return a >= b;
      case '<=': return a <= b;
      default: throw this.rtError(`Operator tidak dikenal: ${op}`, node);
    }
  }

  divZero(a) {
    if (a === 0) { const e = new Error('Pembagian nol (0/0)'); e.name = 'ArithmeticError'; throw e; }
    return a > 0 ? Infinity : -Infinity;
  }

  async assignment(node, env) {
    const target = node.target;
    if (target.type === 'Identifier') {
      let val = await this.evaluate(node.value, env);
      const current = env.has(target.name) ? env.get(target.name) : undefined;
      switch (node.operator) {
        case '=': break;
        case '+=': val = current + val; break;
        case '-=': val = current - val; break;
        case '*=': val = current * val; break;
        case '/=': val = current / val; break;
      }
      env.set(target.name, val);
      return val;
    }
    if (target.type === 'MemberExpr') {
      const obj = await this.evaluate(target.object, env);
      let val = await this.evaluate(node.value, env);
      if (node.operator !== '=') {
        const current = obj[target.property];
        if (node.operator === '+=') val = current + val;
        else if (node.operator === '-=') val = current - val;
        else if (node.operator === '*=') val = current * val;
        else if (node.operator === '/=') val = current / val;
      }
      obj[target.property] = val;
      return val;
    }
    if (target.type === 'IndexExpr') {
      const obj = await this.evaluate(target.object, env);
      const idx = await this.evaluate(target.index, env);
      let val = await this.evaluate(node.value, env);
      if (node.operator !== '=') {
        const current = obj[idx];
        if (node.operator === '+=') val = current + val;
        else if (node.operator === '-=') val = current - val;
      }
      obj[idx] = val;
      return val;
    }
    throw this.rtError('Target assignment tidak valid', node);
  }

  async member(node, env) {
    if (node.object.type === 'Super') {
      const diri = env.get('diri');
      const induk = env.get('induk');
      if (!induk) throw this.rtError('induk tidak tersedia', node);
      const m = induk[node.property];
      if (typeof m === 'function') return m.bind(diri);
      return m;
    }
    const obj = await this.evaluate(node.object, env);
    if (obj === null || obj === undefined) throw this.rtError(`Tidak bisa mengakses properti '${node.property}' pada kosong`, node);
    const prop = node.property;

    if (Array.isArray(obj) && ARRAY_METHODS[prop]) return ARRAY_METHODS[prop].bind(obj);
    if (typeof obj === 'string' && STRING_METHODS[prop]) return STRING_METHODS[prop].bind(obj);

    return obj[prop];
  }

  async call(node, env) {
    if (node.callee.type === 'MemberExpr' && node.callee.object.type === 'Super') {
      const diri = env.get('diri');
      const induk = env.get('induk');
      const m = induk[node.callee.property];
      if (typeof m !== 'function') throw this.rtError(`Method induk.${node.callee.property} tidak ditemukan`, node);
      const args = await Promise.all(node.args.map((a) => this.evaluate(a, env)));
      return await m.apply(diri, args);
    }
    const callee = await this.evaluate(node.callee, env);
    if (typeof callee !== 'function') {
      throw this.rtError(`'${node.callee.type === 'Identifier' ? node.callee.name : 'Nilai'}' bukan fungsi`, node);
    }
    const args = [];
    for (const a of node.args) args.push(await this.evaluate(a, env));
    try {
      return await callee(...args);
    } catch (e) {
      if (e instanceof ReturnSignal) return e.value;
      if (e && e.mylang) throw e;
      if (e && e.name === 'MylangError') throw e;
      throw this.rtError(e.message, node);
    }
  }

  makeFunction(node, closureEnv) {
    const interp = this;
    const fn = async function (...args) {
      const localEnv = new Environment(closureEnv);
      // bind diri if called as method
      if (this && typeof this === 'object' && this.__isInstance) localEnv.define('diri', this);
      // params
      for (let i = 0; i < node.params.length; i++) {
        const p = node.params[i];
        let v = args[i];
        if (v === undefined && p.default) v = await interp.evaluate(p.default, localEnv);
        localEnv.define(p.name, v);
      }
      try {
        for (const stmt of node.body.body) await interp.execute(stmt, localEnv);
      } catch (e) {
        if (e instanceof ReturnSignal) return e.value;
        throw e;
      }
      return null;
    };
    fn.__mylang = true;
    return fn;
  }

  async forLoop(node, env) {
    const from = await this.evaluate(node.from, env);
    const to = await this.evaluate(node.to, env);
    const loopEnv = new Environment(env);
    const step = from <= to ? 1 : -1;
    for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
      loopEnv.define(node.variable, i);
      try { await this.evaluate(node.body, loopEnv); }
      catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
    }
    return null;
  }

  async whileLoop(node, env) {
    const loopEnv = new Environment(env);
    while (await this.evaluate(node.condition, loopEnv)) {
      try { await this.evaluate(node.body, loopEnv); }
      catch (e) { if (e instanceof BreakSignal) break; if (e instanceof ContinueSignal) continue; throw e; }
    }
    return null;
  }

  async switchStmt(node, env) {
    const disc = await this.evaluate(node.discriminant, env);
    for (const c of node.cases) {
      if ((await this.evaluate(c.test, env)) === disc) return await this.evaluate(c.body, env);
    }
    if (node.defaultCase) return await this.evaluate(node.defaultCase, env);
    return null;
  }

  async tryStmt(node, env) {
    try {
      await this.evaluate(node.block, env);
    } catch (e) {
      if (!node.handler) throw e;
      const catchEnv = new Environment(env);
      if (node.param) catchEnv.define(node.param, e);
      await this.evaluate(node.handler, catchEnv);
    } finally {
      if (node.finalizer) await this.evaluate(node.finalizer, env);
    }
    return null;
  }

  async classDecl(node, env) {
    const interp = this;
    const superClass = node.superclass ? env.get(node.superclass) : null;

    function classFn(...args) {
      const instance = Object.create(classFn.prototype);
      instance.__isInstance = true;
      if (typeof instance.buat === 'function') instance.buat(...args);
      return instance;
    }

    if (superClass) {
      classFn.prototype = Object.create(superClass.prototype);
      classFn.prototype.constructor = classFn;
      classFn.__super = superClass;
    }

    for (const m of node.methods) {
      const methodFn = async function (...args) {
        const localEnv = new Environment(env);
        localEnv.define('diri', this);
        if (superClass) localEnv.define('induk', superClass.prototype);
        for (let i = 0; i < m.params.length; i++) {
          const p = m.params[i];
          let v = args[i];
          if (v === undefined && p.default) v = await interp.evaluate(p.default, localEnv);
          localEnv.define(p.name, v);
        }
        try {
          for (const stmt of m.body.body) await interp.execute(stmt, localEnv);
        } catch (e) {
          if (e instanceof ReturnSignal) return e.value;
          throw e;
        }
        return null;
      };
      if (m.static) classFn[m.name] = methodFn;
      else classFn.prototype[m.name] = methodFn;
    }

    env.define(node.name, classFn);
    return null;
  }

  async importDecl(node, env) {
    const resolved = path.resolve(this.currentDir, node.source);
    const exports = await this.loadModule(resolved);
    for (const spec of node.specifiers) {
      if (typeof spec === 'object' && spec.default) env.define(spec.name, exports.default);
      else env.define(spec, exports[spec]);
    }
    return null;
  }

  async loadModule(absPath) {
    if (this.moduleCache.has(absPath)) return this.moduleCache.get(absPath);
    if (!fs.existsSync(absPath)) {
      const e = new Error(`Modul tidak ditemukan: ${absPath}`); e.name = 'ImportError'; throw e;
    }
    const src = fs.readFileSync(absPath, 'utf8');
    const tokens = new Lexer(src, absPath).tokenize();
    const ast = new Parser(tokens, absPath).parse();
    const modEnv = new Environment(this.global);
    const prevDir = this.currentDir;
    this.currentDir = path.dirname(absPath);
    try {
      for (const stmt of ast.body) await this.execute(stmt, modEnv);
    } finally {
      this.currentDir = prevDir;
    }
    this.moduleCache.set(absPath, modEnv.getExports());
    return modEnv.getExports();
  }

  formatValue(v, topLevel = false) {
    if (v === null || v === undefined) return 'kosong';
    if (v === true) return 'benar';
    if (v === false) return 'salah';
    if (typeof v === 'string') return topLevel ? v : `"${v}"`;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'function') return `<fungsi>`;
    if (Array.isArray(v)) return '[' + v.map((x) => this.formatValue(x)).join(', ') + ']';
    if (typeof v === 'object') {
      if (v.__isInstance) {
        const props = Object.keys(v).filter((k) => !k.startsWith('__'));
        return `${v.__className || 'objek'} { ${props.map((k) => `${k}: ${this.formatValue(v[k])}`).join(', ')} }`;
      }
      const parts = Object.entries(v).filter(([k]) => !k.startsWith('__')).map(([k, val]) => `${k}: ${this.formatValue(val)}`);
      return '{ ' + parts.join(', ') + ' }';
    }
    return String(v);
  }
}

function defaultInput(prompt) {
  if (prompt) process.stdout.write(prompt);
  const buf = Buffer.alloc(4096);
  const n = fs.readSync(0, buf, 0, buf.length, null);
  return buf.slice(0, n).toString().replace(/\r?\n$/, '');
}
