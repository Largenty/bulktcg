/* Un client Supabase réduit à ce qu'emploie le chargement de la
   démonstration (scripts/supabase-seed/database.mjs), au-dessus de PGlite :
   les migrations rejouées sur un vrai PostgreSQL, sous le rôle service_role
   — celui de la clé secrète, que la RLS ne retient pas et que les
   déclencheurs tiennent. Les réponses ont la forme de celles de PostgREST :
   { data, count, error }, des lignes JSON, les horodatages en texte ISO.

   L'administration des comptes écrit auth.users comme le service
   d'authentification de Supabase : hors des rôles de l'API. */

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function identifier(name) {
  if (!IDENTIFIER.test(name)) throw new Error(`identifiant refusé : ${name}`);
  return name;
}

const columnList = (columns) => (columns.trim() === "*" ? "t.*" : columns.split(",").map((column) => `t.${identifier(column.trim())}`).join(", "));

class Query {
  #db;
  #table;
  #typesOf;
  #action = "select";
  #columns = "*";
  #head = false;
  #returning = null;
  #payload = null;
  #filters = [];
  #order = null;

  constructor(db, table, typesOf) {
    this.#db = db;
    this.#table = identifier(table);
    this.#typesOf = typesOf;
  }

  select(columns = "*", options = {}) {
    if (this.#action === "select") {
      this.#columns = columns;
      this.#head = options.head === true;
    } else {
      this.#returning = columns;
    }
    return this;
  }

  insert(rows) {
    this.#action = "insert";
    this.#payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(fields) {
    this.#action = "update";
    this.#payload = fields;
    return this;
  }

  in(column, values) {
    this.#filters.push([identifier(column), "in", values]);
    return this;
  }

  eq(column, value) {
    this.#filters.push([identifier(column), "=", value]);
    return this;
  }

  neq(column, value) {
    this.#filters.push([identifier(column), "<>", value]);
    return this;
  }

  order(column) {
    this.#order = identifier(column);
    return this;
  }

  then(resolve, reject) {
    return this.#execute().then(resolve, reject);
  }

  async #execute() {
    try {
      return await this.#run();
    } catch (error) {
      return { data: null, count: null, error: { message: error.message, code: error.code } };
    }
  }

  async #run() {
    const types = await this.#typesOf(this.#table);
    const params = [];
    const param = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    const table = `public.${this.#table}`;
    /* La charge d'une écriture passe la première : $1. */
    const payload = this.#action === "select" ? null : param(JSON.stringify(this.#payload));
    const where = this.#filters.map(([column, operator, value]) => {
      const type = types.get(column);
      if (!type) throw new Error(`colonne inconnue : ${this.#table}.${column}`);
      return operator === "in"
        ? `t.${column} = any(array(select json_array_elements_text(${param(JSON.stringify(value))}::json)::${type}))`
        : `t.${column} ${operator} ${param(value)}::${type}`;
    });
    const filter = where.length > 0 ? ` where ${where.join(" and ")}` : "";

    if (this.#action === "insert") {
      const columns = [...new Set(this.#payload.flatMap((row) => Object.keys(row)))].map(identifier).join(", ");
      await this.#db.query(`insert into ${table} (${columns}) select ${columns} from json_populate_recordset(null::${table}, ${payload}::json)`, params);
      return { data: null, count: null, error: null };
    }
    if (this.#action === "update") {
      const assignments = Object.keys(this.#payload).map((column) => `${identifier(column)} = r.${column}`).join(", ");
      const returning = this.#returning === null ? "" : ` returning ${columnList(this.#returning)}`;
      const result = await this.#db.query(`update ${table} as t set ${assignments} from json_populate_record(null::${table}, ${payload}::json) as r${filter}${returning}`, params);
      return { data: this.#returning === null ? null : result.rows, count: null, error: null };
    }
    if (this.#head) {
      const result = await this.#db.query(`select count(*)::integer as count from ${table} as t${filter}`, params);
      return { data: null, count: result.rows[0].count, error: null };
    }
    const order = this.#order === null ? "" : ` order by t.${this.#order}`;
    const result = await this.#db.query(`select coalesce(json_agg(r), '[]'::json) as rows from (select ${columnList(this.#columns)} from ${table} as t${filter}${order}) as r`, params);
    return { data: result.rows[0].rows, count: null, error: null };
  }
}

/* Le client, sur une base où les migrations sont déjà passées. */
export async function createPgliteAdmin(db) {
  await db.exec("set role service_role");
  const cache = new Map();
  async function typesOf(table) {
    if (!cache.has(table)) {
      const result = await db.query(
        "select attname as name, format_type(atttypid, atttypmod) as type from pg_attribute where attrelid = ('public.' || $1)::regclass and attnum > 0 and not attisdropped",
        [table],
      );
      cache.set(table, new Map(result.rows.map((row) => [row.name, row.type])));
    }
    return cache.get(table);
  }
  async function asAuthService(sql, params) {
    await db.exec("reset role");
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec("set role service_role");
    }
  }
  const failure = (error) => ({ message: error.message, code: error.code, status: 500 });
  return {
    from: (table) => new Query(db, table, typesOf),
    auth: {
      admin: {
        async getUserById(id) {
          const result = await asAuthService("select id::text as id, email from auth.users where id = $1::uuid", [id]);
          const [user] = result.rows;
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "User not found", status: 404 } };
        },
        async createUser({ id, email, user_metadata: metadata }) {
          try {
            await asAuthService("insert into auth.users (id, email, raw_user_meta_data) values ($1::uuid, $2, $3::jsonb)", [id, email, JSON.stringify(metadata ?? {})]);
            return { data: { user: { id, email } }, error: null };
          } catch (error) {
            return { data: { user: null }, error: failure(error) };
          }
        },
        async updateUserById(id) {
          return { data: { user: { id } }, error: null };
        },
        async deleteUser(id) {
          try {
            await asAuthService("delete from auth.users where id = $1::uuid", [id]);
            return { data: {}, error: null };
          } catch (error) {
            return { data: null, error: failure(error) };
          }
        },
      },
    },
  };
}
