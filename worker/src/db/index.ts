import Database from 'better-sqlite3';

// 初始化数据库连接
const dbPath = process.env.DATABASE_PATH || './data/activation.db';
const db = new Database(dbPath);

// 启用 WAL 模式提升性能
db.pragma('journal_mode = WAL');

// 适配 Cloudflare D1 API
export const createDB = () => ({
  prepare: (sql: string) => {
    const stmt = db.prepare(sql);
    return {
      bind: (...params: any[]) => ({
        run: () => stmt.run(...params),
        first: <T>() => stmt.get(...params) as T | undefined,
        all: <T>() => ({ results: stmt.all(...params) as T[] }),
      }),
      run: () => stmt.run(),
      first: <T>() => stmt.get() as T | undefined,
      all: <T>() => ({ results: stmt.all() as T[] }),
    };
  },
});

// 导出数据库实例供初始化使用
export { db };
