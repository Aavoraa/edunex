/**
 * Tiny WHERE-clause builder that keeps every value parameterised.
 *   const w = new Where();
 *   w.add('s.campus_id = ?', campusId);
 *   query(`SELECT … ${w.sql} …`, w.params)
 * `?` placeholders are rewritten to $n in order.
 */
export class Where {
  private parts: string[] = [];
  readonly params: unknown[] = [];

  add(fragment: string, ...values: unknown[]) {
    let i = 0;
    const text = fragment.replace(/\?/g, () => {
      this.params.push(values[i++]);
      return `$${this.params.length}`;
    });
    this.parts.push(`(${text})`);
    return this;
  }

  /** Adds the fragment only when `value` is not undefined / null / ''. */
  addIf(value: unknown, fragment: string, ...values: unknown[]) {
    if (value === undefined || value === null || value === '') return this;
    return this.add(fragment, ...(values.length ? values : [value]));
  }

  /** Pushes a value and returns its $n placeholder (for LIMIT/OFFSET etc.). */
  param(value: unknown) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  get sql() {
    return this.parts.length ? `WHERE ${this.parts.join(' AND ')}` : '';
  }

  get and() {
    return this.parts.length ? `AND ${this.parts.join(' AND ')}` : '';
  }
}
