export class Environment {
  constructor(parent = null) {
    this.parent = parent;
    this.vars = new Map();
    this.constants = new Set();
    this.exports = {};
  }

  define(name, value, constant = false) {
    this.vars.set(name, value);
    if (constant) this.constants.add(name);
  }

  has(name) {
    if (this.vars.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }

  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }

  isConstant(name) {
    if (this.constants.has(name)) return true;
    return this.parent ? this.parent.isConstant(name) : false;
  }

  set(name, value) {
    if (this.vars.has(name)) {
      if (this.constants.has(name)) throw mkError('TypeError', `Tidak bisa mengubah konstanta '${name}'`);
      this.vars.set(name, value);
      return;
    }
    if (this.parent && this.parent.has(name)) { this.parent.set(name, value); return; }
    this.vars.set(name, value);
  }

  getExports() { return this.exports; }
}

function mkError(name, msg) {
  const e = new Error(msg); e.name = name; return e;
}
