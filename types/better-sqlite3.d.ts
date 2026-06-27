declare module 'better-sqlite3' {
  type PragmaOptions = {
    simple?: boolean;
  };

  type DatabaseOptions = {
    readonly?: boolean;
    fileMustExist?: boolean;
  };

  class Database {
    constructor(filename: string, options?: DatabaseOptions);
    pragma(source: string, options?: PragmaOptions): unknown;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      run(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
    transaction<T extends (...args: unknown[]) => unknown>(fn: T): T;
    close(): void;
  }

  export default Database;
}
