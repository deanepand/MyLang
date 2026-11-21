export const TT = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  IDENTIFIER: 'IDENTIFIER',
  KEYWORD: 'KEYWORD',
  OP: 'OP',
  PUNCT: 'PUNCT',
  EOF: 'EOF',
};

const KEYWORDS = new Set([
  'jika', 'selain', 'untuk', 'dari', 'sampai', 'selama', 'berhenti', 'lanjut',
  'pilih', 'kasus', 'standar', 'fungsi', 'kembalikan', 'tetap', 'benar', 'salah',
  'kosong', 'dan', 'atau', 'bukan', 'kelas', 'diri', 'induk',
  'coba', 'tangkap', 'akhirnya', 'ambil', 'ekspor', 'asinkron', 'tunggu',
  'pastikan', 'lemparkan',
]);

const OPS = ['**', '==', '!=', '>=', '<=', '+=', '-=', '*=', '/=',
             '+', '-', '*', '/', '%', '=', '>', '<'];

const PUNCTS = ['(', ')', '{', '}', '[', ']', ',', ':', '.'];

export class Lexer {
  constructor(source, filename = '<input>') {
    this.source = source;
    this.filename = filename;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
  }

  error(msg) {
    const e = new Error(`${msg} (${this.filename}:${this.line}:${this.col})`);
    e.name = 'SyntaxError';
    e.line = this.line;
    e.col = this.col;
    e.filename = this.filename;
    throw e;
  }

  peek(n = 0) { return this.source[this.pos + n]; }

  advance() {
    const c = this.source[this.pos++];
    if (c === '\n') { this.line++; this.col = 1; } else { this.col++; }
    return c;
  }

  tokenize() {
    while (this.pos < this.source.length) {
      this.skipWsAndComments();
      if (this.pos >= this.source.length) break;
      const line = this.line, col = this.col;
      const c = this.peek();

      if (c >= '0' && c <= '9') this.tokens.push(this.readNumber(line, col));
      else if (c === '"' || c === "'") this.tokens.push(this.readString(line, col));
      else if (this.isIdentStart(c)) this.tokens.push(this.readIdent(line, col));
      else if (this.matchOp(line, col)) { /* consumed */ }
      else if (PUNCTS.includes(c)) {
        this.advance();
        this.tokens.push({ type: TT.PUNCT, value: c, line, col });
      } else {
        this.error(`Karakter tidak dikenal: '${c}'`);
      }
    }
    this.tokens.push({ type: TT.EOF, value: null, line: this.line, col: this.col });
    return this.tokens;
  }

  skipWsAndComments() {
    while (this.pos < this.source.length) {
      const c = this.peek();
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { this.advance(); continue; }
      if (c === '/' && this.peek(1) === '/') {
        while (this.pos < this.source.length && this.peek() !== '\n') this.advance();
        continue;
      }
      if (c === '/' && this.peek(1) === '*') {
        this.advance(); this.advance();
        while (this.pos < this.source.length && !(this.peek() === '*' && this.peek(1) === '/')) this.advance();
        if (this.pos < this.source.length) { this.advance(); this.advance(); }
        continue;
      }
      break;
    }
  }

  isIdentStart(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'; }
  isIdentPart(c) { return this.isIdentStart(c) || (c >= '0' && c <= '9'); }

  readNumber(line, col) {
    let s = '';
    while (this.peek() >= '0' && this.peek() <= '9') s += this.advance();
    if (this.peek() === '.' && this.peek(1) >= '0' && this.peek(1) <= '9') {
      s += this.advance();
      while (this.peek() >= '0' && this.peek() <= '9') s += this.advance();
    }
    return { type: TT.NUMBER, value: Number(s), line, col };
  }

  readString(line, col) {
    const quote = this.advance();
    let s = '';
    while (this.pos < this.source.length && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance();
        const e = this.advance();
        if (e === 'n') s += '\n';
        else if (e === 't') s += '\t';
        else if (e === 'r') s += '\r';
        else if (e === '\\') s += '\\';
        else if (e === quote) s += quote;
        else s += '\\' + e;
      } else s += this.advance();
    }
    if (this.pos >= this.source.length) this.error('String tidak ditutup');
    this.advance();
    return { type: TT.STRING, value: s, line, col };
  }

  readIdent(line, col) {
    let s = '';
    while (this.isIdentPart(this.peek())) s += this.advance();
    if (KEYWORDS.has(s)) return { type: TT.KEYWORD, value: s, line, col };
    return { type: TT.IDENTIFIER, value: s, line, col };
  }

  matchOp(line, col) {
    for (const op of OPS) {
      if (this.source.startsWith(op, this.pos)) {
        for (let i = 0; i < op.length; i++) this.advance();
        this.tokens.push({ type: TT.OP, value: op, line, col });
        return true;
      }
    }
    return false;
  }
}
