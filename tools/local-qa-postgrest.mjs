// Offline QA only: tiny PostgREST-shaped adapter backed by an isolated local
// PostgreSQL container. NEVER import this module from the Worker.
import pg from 'pg';

const tables = new Set([
  'profiles',
  'orders',
  'payments',
  'entitlements',
  'unlocks',
  'sticks',
  'stick_locales',
  'paid_ai_readings',
]);

const signatures = {
  settle_stripe_payment: [
    ['p_event_id', 'text'],
    ['p_type', 'text'],
    ['p_provider', 'text'],
    ['p_payment_ref', 'text'],
    ['p_charge_ref', 'text'],
    ['p_user_id', 'uuid'],
    ['p_order_id', 'uuid'],
    ['p_product_id', 'text'],
    ['p_amount', 'bigint'],
    ['p_currency', 'text'],
    ['p_paid', 'boolean'],
    ['p_amount_refunded', 'bigint'],
    ['p_dispute', 'text'],
    ['p_subscription_ref', 'text'],
    ['p_period_start', 'timestamptz'],
    ['p_period_end', 'timestamptz'],
    ['p_paid_at', 'timestamptz'],
    ['p_fetched_at', 'timestamptz'],
  ],
  revoke_for_refund: [
    ['p_payment_ref', 'text'],
    ['p_refund_amount', 'bigint'],
    ['p_dispute', 'text'],
  ],
  consume_pack_use: [
    ['p_user_id', 'uuid'],
    ['p_pack_id', 'uuid'],
    ['p_stick_id', 'smallint'],
    ['p_category', 'text'],
    ['p_locale', 'text'],
  ],
  claim_paid_ai_reading: [
    ['p_user_id', 'uuid'],
    ['p_stick_id', 'smallint'],
    ['p_category', 'text'],
    ['p_locale', 'text'],
  ],
  finish_paid_ai_reading: [
    ['p_user_id', 'uuid'],
    ['p_unlock_id', 'uuid'],
    ['p_claim_id', 'uuid'],
    ['p_body', 'text'],
    ['p_model', 'text'],
  ],
  fail_paid_ai_reading: [
    ['p_user_id', 'uuid'],
    ['p_unlock_id', 'uuid'],
    ['p_claim_id', 'uuid'],
  ],
  get_paid_ai_reading: [
    ['p_user_id', 'uuid'],
    ['p_stick_id', 'smallint'],
    ['p_category', 'text'],
    ['p_locale', 'text'],
  ],
  get_deep_reading: [
    ['p_user_id', 'uuid'],
    ['p_stick_id', 'smallint'],
    ['p_category', 'text'],
    ['p_locale', 'text'],
  ],
  paid_ai_delivery_ready: [],
};

function id(value) {
  if (!/^[a-z_][a-z_0-9]*$/.test(value)) {
    throw new Error(`Test adapter refused identifier: ${value}`);
  }
  return `"${value}"`;
}

class Builder {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.mode = 'select';
    this.columns = '*';
    this.filters = [];
    this.sort = null;
    this.maxRows = null;
    this.payload = null;
    this.head = false;
    this.count = false;
    this.ignoreDuplicates = false;
  }
  select(columns = '*', opts = {}) {
    this.columns = columns;
    this.count = opts.count === 'exact';
    this.head = opts.head === true;
    return this;
  }
  eq(column, value) {
    this.filters.push([column, '=', value]);
    return this;
  }
  gte(column, value) {
    this.filters.push([column, '>=', value]);
    return this;
  }
  is(column, value) {
    this.filters.push([column, 'IS', value]);
    return this;
  }
  order(column, { ascending = true } = {}) {
    this.sort = [column, ascending ? 'ASC' : 'DESC'];
    return this;
  }
  limit(n) {
    this.maxRows = n;
    return this;
  }
  insert(payload) {
    this.mode = 'insert';
    this.payload = payload;
    return this;
  }
  upsert(payload, opts = {}) {
    this.mode = 'upsert';
    this.payload = payload;
    this.ignoreDuplicates = opts.ignoreDuplicates === true;
    if (opts.onConflict !== 'id') throw new Error('Only local profile id upsert is supported');
    return this;
  }
  update(payload) {
    this.mode = 'update';
    this.payload = payload;
    return this;
  }
  maybeSingle() {
    return this.execute('maybe');
  }
  single() {
    return this.execute('single');
  }
  // A Supabase PostgREST query can be awaited without .single().
  // biome-ignore lint/suspicious/noThenProperty: intentional test adapter for Supabase's thenable PostgREST query API.
  then(onSuccess, onFailure) {
    return this.execute('many').then(onSuccess, onFailure);
  }

  async execute(resultType) {
    const values = [];
    const where = this.filters
      .map(([column, operator, value]) => {
        if (operator === 'IS') {
          if (value !== null) throw new Error('Only IS NULL supported');
          return `${id(column)} IS NULL`;
        }
        values.push(value);
        return `${id(column)} ${operator} $${values.length}`;
      })
      .join(' AND ');
    const clause = where ? ` WHERE ${where}` : '';
    const selection =
      this.columns === '*'
        ? '*'
        : this.columns
            .split(',')
            .map((column) => id(column.trim()))
            .join(', ');
    let sql;
    if (this.mode === 'select') {
      sql =
        'SELECT ' +
        (this.count && this.head ? 'count(*)::integer AS n' : selection) +
        ' FROM public.' +
        id(this.table) +
        clause;
      if (this.sort && !(this.count && this.head)) {
        sql += ` ORDER BY ${id(this.sort[0])} ${this.sort[1]}`;
      }
      if (this.maxRows != null) sql += ` LIMIT ${Number(this.maxRows)}`;
    } else if (this.mode === 'update') {
      if (!this.filters.length) throw new Error('Refusing unfiltered test update');
      const sets = Object.entries(this.payload).map(([column, value]) => {
        values.push(value);
        return `${id(column)} = $${values.length}`;
      });
      sql = `UPDATE public.${id(this.table)} SET ${sets.join(', ')}${clause} RETURNING ${selection}`;
    } else {
      const entries = Object.entries(this.payload);
      const inserts = entries.map(([column, value]) => {
        values.push(value);
        return id(column);
      });
      sql =
        'INSERT INTO public.' +
        id(this.table) +
        '(' +
        inserts.join(',') +
        ')' +
        ' VALUES (' +
        entries.map((_, i) => `$${values.length - entries.length + i + 1}`).join(',') +
        ')';
      if (this.mode === 'upsert')
        sql += this.ignoreDuplicates
          ? ' ON CONFLICT (id) DO NOTHING'
          : ' ON CONFLICT (id) DO UPDATE SET updated_at = now()';
      sql += ` RETURNING ${selection}`;
    }
    try {
      const out = await this.pool.query(sql, values);
      if (this.count && this.head) return { count: out.rows[0]?.n ?? 0, data: null, error: null };
      const data = resultType === 'many' ? out.rows : (out.rows[0] ?? null);
      if (resultType === 'single' && out.rows.length !== 1) {
        return { data: null, error: { code: 'PGRST116', message: 'Expected exactly one row' } };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { code: error.code ?? 'LOCAL_QA_ERROR', message: error.message } };
    }
  }
}

export class LocalQaDatabase {
  constructor(connectionString) {
    const url = new URL(connectionString);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/postgres' ||
      url.protocol !== 'postgresql:'
    ) {
      throw new Error('Refusing non-local or non-ephemeral QA PostgreSQL database URL');
    }
    this.pool = new pg.Pool({ connectionString, max: 8, connectionTimeoutMillis: 2000 });
  }
  from(table) {
    if (!tables.has(table)) throw new Error(`Unauthorized test table: ${table}`);
    return new Builder(this.pool, table);
  }
  async rpc(name, args = {}) {
    const signature = signatures[name];
    if (!signature) throw new Error(`Unauthorized local QA SQL function: ${name}`);
    const values = signature.map(([param]) => args[param] ?? null);
    const argumentsSql = signature.map(([, type], i) => `$${i + 1}::${type}`).join(',');
    try {
      const out = await this.pool.query(`SELECT public.${id(name)}(${argumentsSql}) AS value`, values);
      return { data: out.rows[0]?.value ?? null, error: null };
    } catch (error) {
      return { data: null, error: { code: error.code ?? 'LOCAL_QA_ERROR', message: error.message } };
    }
  }
  query(sql, params) {
    return this.pool.query(sql, params);
  }
  close() {
    return this.pool.end();
  }
}
