import { TT, Lexer } from './lexer.js';

export class Parser {
  constructor(tokens, filename) {
    this.tokens = tokens;
    this.pos = 0;
    this.filename = filename;
  }

  parse() {
    const body = [];
    while (!this.isEOF()) body.push(this.declaration());
    return { type: 'Program', body, filename: this.filename, line: 1, col: 1 };
  }

  peek(n = 0) { return this.tokens[this.pos + n]; }
  isEOF() { return this.peek().type === TT.EOF; }
  check(type, value) { const t = this.peek(); return t.type === type && (value === undefined || t.value === value); }
  checkKw(v) { return this.check(TT.KEYWORD, v); }
  checkOp(v) { return this.check(TT.OP, v); }
  checkPunct(v) { return this.check(TT.PUNCT, v); }
  advance() { return this.tokens[this.pos++]; }
  eat(type, value) { return this.check(type, value) ? this.advance() : null; }

  expect(type, value, msg) {
    if (this.check(type, value)) return this.advance();
    const t = this.peek();
    const e = new Error(`${msg || `Diharapkan '${value ?? type}'`} (baris ${t.line}, kolom ${t.col})`);
    e.name = 'SyntaxError'; e.line = t.line; e.col = t.col; e.filename = this.filename;
    throw e;
  }

  declaration() {
    const start = this.peek();
    let node;
    if (this.checkKw('tetap')) node = this.varDecl(true);
    else if (this.checkKw('fungsi')) node = this.funcDecl(false);
    else if (this.checkKw('asinkron') && this.peek(1).value === 'fungsi') { this.advance(); node = this.funcDecl(true); }
    else if (this.checkKw('kelas')) node = this.classDecl();
    else if (this.checkKw('ambil')) node = this.importDecl();
    else if (this.checkKw('ekspor')) node = this.exportDecl();
    else node = this.statement();
    if (node && !node.line) { node.line = start.line; node.col = start.col; }
    return node;
  }

  varDecl(constant) {
    const start = this.peek();
    this.advance();
    const name = this.expect(TT.IDENTIFIER, null, 'Nama variabel').value;
    this.expect(TT.OP, '=');
    const value = this.expression();
    return { type: 'VarDecl', constant, name, value, line: start.line, col: start.col };
  }

  funcDecl(isAsync) {
    this.expect(TT.KEYWORD, 'fungsi');
    let name = null;
    if (this.check(TT.IDENTIFIER)) name = this.advance().value;
    const params = this.parseParams();
    const body = this.block();
    return { type: 'FunctionDecl', name, params, body, async: isAsync };
  }

  parseParams() {
    this.expect(TT.PUNCT, '(');
    const params = [];
    while (!this.checkPunct(')')) {
      const name = this.expect(TT.IDENTIFIER, null, 'Nama parameter').value;
      let def = null;
      if (this.eat(TT.OP, '=')) def = this.expression();
      params.push({ name, default: def });
      if (!this.eat(TT.PUNCT, ',')) break;
    }
    this.expect(TT.PUNCT, ')');
    return params;
  }

  classDecl() {
    this.expect(TT.KEYWORD, 'kelas');
    const name = this.expect(TT.IDENTIFIER).value;
    let superclass = null;
    if (this.eat(TT.KEYWORD, 'dari')) superclass = this.expect(TT.IDENTIFIER).value;
    this.expect(TT.PUNCT, '{');
    const methods = [];
    while (!this.checkPunct('}')) {
      if (this.checkKw('tetap')) {
        this.advance();
        const fn = this.funcDecl(false);
        methods.push({ ...fn, static: true });
      } else if (this.checkKw('fungsi')) {
        methods.push(this.funcDecl(false));
      } else {
        this.expect(TT.KEYWORD, 'fungsi', 'Diharapkan fungsi dalam kelas');
      }
    }
    this.expect(TT.PUNCT, '}');
    return { type: 'ClassDecl', name, superclass, methods };
  }

  importDecl() {
    this.expect(TT.KEYWORD, 'ambil');
    const specifiers = [];
    if (this.checkPunct('{')) {
      this.advance();
      while (!this.checkPunct('}')) {
        specifiers.push(this.expect(TT.IDENTIFIER).value);
        if (!this.eat(TT.PUNCT, ',')) break;
      }
      this.expect(TT.PUNCT, '}');
    } else {
      const name = this.expect(TT.IDENTIFIER).value;
      specifiers.push({ default: true, name });
    }
    this.expect(TT.KEYWORD, 'dari');
    const source = this.expect(TT.STRING).value;
    return { type: 'ImportDecl', specifiers, source };
  }

  exportDecl() {
    this.expect(TT.KEYWORD, 'ekspor');
    if (this.checkKw('standar')) {
      this.advance();
      const expr = this.expression();
      return { type: 'ExportDefault', expression: expr };
    }
    if (this.checkKw('fungsi')) return { type: 'ExportDecl', declaration: this.funcDecl(false) };
    if (this.checkKw('kelas')) return { type: 'ExportDecl', declaration: this.classDecl() };
    if (this.checkKw('tetap')) return { type: 'ExportDecl', declaration: this.varDecl(true) };
    const names = [this.expect(TT.IDENTIFIER).value];
    while (this.eat(TT.PUNCT, ',')) names.push(this.expect(TT.IDENTIFIER).value);
    return { type: 'ExportNames', names };
  }

  statement() {
    if (this.checkPunct('{')) return this.block();
    if (this.checkKw('jika')) return this.ifStmt();
    if (this.checkKw('untuk')) return this.forStmt();
    if (this.checkKw('selama')) return this.whileStmt();
    if (this.checkKw('berhenti')) { this.advance(); return { type: 'BreakStmt' }; }
    if (this.checkKw('lanjut')) { this.advance(); return { type: 'ContinueStmt' }; }
    if (this.checkKw('kembalikan')) {
      this.advance();
      let arg = null;
      if (!this.checkPunct('}') && !this.isEOF()) arg = this.expression();
      return { type: 'ReturnStmt', argument: arg };
    }
    if (this.checkKw('pilih')) return this.switchStmt();
    if (this.checkKw('coba')) return this.tryStmt();
    if (this.checkKw('pastikan')) {
      this.advance();
      return { type: 'AssertStmt', condition: this.expression() };
    }
    if (this.checkKw('lemparkan')) {
      this.advance();
      return { type: 'ThrowStmt', argument: this.expression() };
    }
    return { type: 'ExprStmt', expression: this.expression() };
  }

  block() {
    this.expect(TT.PUNCT, '{');
    const body = [];
    while (!this.checkPunct('}') && !this.isEOF()) body.push(this.declaration());
    this.expect(TT.PUNCT, '}');
    return { type: 'Block', body };
  }

  ifStmt() {
    this.expect(TT.KEYWORD, 'jika');
    const condition = this.expression();
    const consequent = this.block();
    let alternate = null;
    if (this.checkKw('selain')) {
      this.advance();
      alternate = this.checkKw('jika') ? this.ifStmt() : this.block();
    }
    return { type: 'IfStmt', condition, consequent, alternate };
  }

  forStmt() {
    this.expect(TT.KEYWORD, 'untuk');
    const variable = this.expect(TT.IDENTIFIER).value;
    this.expect(TT.KEYWORD, 'dari');
    const from = this.expression();
    this.expect(TT.KEYWORD, 'sampai');
    const to = this.expression();
    const body = this.block();
    return { type: 'ForStmt', variable, from, to, body };
  }

  whileStmt() {
    this.expect(TT.KEYWORD, 'selama');
    const condition = this.expression();
    const body = this.block();
    return { type: 'WhileStmt', condition, body };
  }

  switchStmt() {
    this.expect(TT.KEYWORD, 'pilih');
    const discriminant = this.expression();
    this.expect(TT.PUNCT, '{');
    const cases = [];
    let defaultCase = null;
    while (!this.checkPunct('}')) {
      if (this.checkKw('kasus')) {
        this.advance();
        const test = this.expression();
        cases.push({ test, body: this.block() });
      } else if (this.checkKw('standar')) {
        this.advance();
        defaultCase = this.block();
      } else this.expect(TT.KEYWORD, 'kasus');
    }
    this.expect(TT.PUNCT, '}');
    return { type: 'SwitchStmt', discriminant, cases, defaultCase };
  }

  tryStmt() {
    this.expect(TT.KEYWORD, 'coba');
    const block = this.block();
    let param = null, handler = null, finalizer = null;
    if (this.checkKw('tangkap')) {
      this.advance();
      param = this.check(TT.IDENTIFIER) ? this.advance().value : 'error';
      handler = this.block();
    }
    if (this.checkKw('akhirnya')) {
      this.advance();
      finalizer = this.block();
    }
    return { type: 'TryStmt', block, param, handler, finalizer };
  }

  expression() { return this.assignment(); }

  assignment() {
    const left = this.logicalOr();
    const t = this.peek();
    if (t.type === TT.OP && ['=', '+=', '-=', '*=', '/='].includes(t.value)) {
      this.advance();
      const right = this.assignment();
      return { type: 'Assignment', target: left, operator: t.value, value: right };
    }
    return left;
  }

  logicalOr() {
    let left = this.logicalAnd();
    while (this.checkKw('atau')) { this.advance(); left = { type: 'BinaryExpr', operator: 'atau', left, right: this.logicalAnd() }; }
    return left;
  }

  logicalAnd() {
    let left = this.equality();
    while (this.checkKw('dan')) { this.advance(); left = { type: 'BinaryExpr', operator: 'dan', left, right: this.equality() }; }
    return left;
  }

  equality() {
    let left = this.comparison();
    while (this.checkOp('==') || this.checkOp('!=')) { const op = this.advance().value; left = { type: 'BinaryExpr', operator: op, left, right: this.comparison() }; }
    return left;
  }

  comparison() {
    let left = this.additive();
    while (['>', '<', '>=', '<='].some((o) => this.checkOp(o))) { const op = this.advance().value; left = { type: 'BinaryExpr', operator: op, left, right: this.additive() }; }
    return left;
  }

  additive() {
    let left = this.multiplicative();
    while (this.checkOp('+') || this.checkOp('-')) { const op = this.advance().value; left = { type: 'BinaryExpr', operator: op, left, right: this.multiplicative() }; }
    return left;
  }

  multiplicative() {
    let left = this.power();
    while (this.checkOp('*') || this.checkOp('/') || this.checkOp('%')) { const op = this.advance().value; left = { type: 'BinaryExpr', operator: op, left, right: this.power() }; }
    return left;
  }

  power() {
    let left = this.unary();
    if (this.checkOp('**')) { this.advance(); left = { type: 'BinaryExpr', operator: '**', left, right: this.power() }; }
    return left;
  }

  unary() {
    if (this.checkKw('bukan')) { this.advance(); return { type: 'UnaryExpr', operator: 'bukan', argument: this.unary() }; }
    if (this.checkOp('-')) { this.advance(); return { type: 'UnaryExpr', operator: '-', argument: this.unary() }; }
    if (this.checkKw('tunggu')) { this.advance(); return { type: 'AwaitExpr', argument: this.unary() }; }
    return this.callMember();
  }

  callMember() {
    let expr = this.primary();
    while (true) {
      if (this.checkPunct('(')) {
        this.advance();
        const args = [];
        while (!this.checkPunct(')')) { args.push(this.expression()); if (!this.eat(TT.PUNCT, ',')) break; }
        this.expect(TT.PUNCT, ')');
        expr = { type: 'CallExpr', callee: expr, args };
      } else if (this.checkPunct('.')) {
        this.advance();
        expr = { type: 'MemberExpr', object: expr, property: this.expect(TT.IDENTIFIER).value };
      } else if (this.checkPunct('[')) {
        this.advance();
        const index = this.expression();
        this.expect(TT.PUNCT, ']');
        expr = { type: 'IndexExpr', object: expr, index };
      } else break;
    }
    return expr;
  }

  primary() {
    const t = this.peek();
    if (t.type === TT.NUMBER) { this.advance(); return { type: 'Literal', value: t.value, line: t.line, col: t.col }; }
    if (t.type === TT.STRING) { this.advance(); return this.parseString(t.value); }
    if (t.type === TT.KEYWORD) {
      if (t.value === 'benar') { this.advance(); return { type: 'Literal', value: true }; }
      if (t.value === 'salah') { this.advance(); return { type: 'Literal', value: false }; }
      if (t.value === 'kosong') { this.advance(); return { type: 'Literal', value: null }; }
      if (t.value === 'diri') { this.advance(); return { type: 'This' }; }
      if (t.value === 'induk') { this.advance(); return { type: 'Super' }; }
      if (t.value === 'fungsi') { const fn = this.funcDecl(false); return { type: 'FunctionExpr', params: fn.params, body: fn.body, async: false }; }
      if (t.value === 'asinkron') { this.advance(); const fn = this.funcDecl(true); return { type: 'FunctionExpr', params: fn.params, body: fn.body, async: true }; }
    }
    if (t.type === TT.IDENTIFIER) { this.advance(); return { type: 'Identifier', name: t.value, line: t.line, col: t.col }; }
    if (t.type === TT.PUNCT) {
      if (t.value === '(') { this.advance(); const e = this.expression(); this.expect(TT.PUNCT, ')'); return e; }
      if (t.value === '[') return this.arrayLiteral();
      if (t.value === '{') return this.objectLiteral();
    }
    const e = new Error(`Ekspresi tidak valid: '${t.value}' (baris ${t.line}, kolom ${t.col})`);
    e.name = 'SyntaxError'; e.line = t.line; e.col = t.col; e.filename = this.filename;
    throw e;
  }

  parseString(raw) {
    if (!raw.includes('{')) return { type: 'Literal', value: raw };
    const parts = [];
    let i = 0, start = 0;
    while (i < raw.length) {
      if (raw[i] === '{') {
        if (i > start) parts.push({ type: 'text', value: raw.slice(start, i) });
        let depth = 1, j = i + 1;
        while (j < raw.length && depth > 0) {
          if (raw[j] === '{') depth++;
          else if (raw[j] === '}') depth--;
          j++;
        }
        if (depth !== 0) { const e = new Error('Interpolasi string tidak ditutup'); e.name = 'SyntaxError'; throw e; }
        parts.push({ type: 'expr', value: raw.slice(i + 1, j - 1) });
        i = j; start = j;
      } else i++;
    }
    if (start < raw.length) parts.push({ type: 'text', value: raw.slice(start) });
    return { type: 'TemplateLiteral', parts };
  }

  arrayLiteral() {
    this.expect(TT.PUNCT, '[');
    const elements = [];
    while (!this.checkPunct(']')) { elements.push(this.expression()); if (!this.eat(TT.PUNCT, ',')) break; }
    this.expect(TT.PUNCT, ']');
    return { type: 'ArrayLiteral', elements };
  }

  objectLiteral() {
    this.expect(TT.PUNCT, '{');
    const properties = [];
    while (!this.checkPunct('}')) {
      const t = this.peek();
      let key;
      if (t.type === TT.IDENTIFIER || t.type === TT.KEYWORD || t.type === TT.STRING) key = this.advance().value;
      else { const e = new Error('Kunci objek tidak valid'); e.name = 'SyntaxError'; throw e; }
      this.expect(TT.PUNCT, ':');
      properties.push({ key, value: this.expression() });
      if (!this.eat(TT.PUNCT, ',')) break;
    }
    this.expect(TT.PUNCT, '}');
    return { type: 'ObjectLiteral', properties };
  }
}
