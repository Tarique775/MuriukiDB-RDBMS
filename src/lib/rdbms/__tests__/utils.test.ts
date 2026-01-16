import { describe, it, expect } from 'vitest';
import { splitSqlStatements } from '../utils';

describe('splitSqlStatements', () => {
  it('splits semicolons outside quotes', () => {
    const input = "INSERT INTO t (x) VALUES ('a;b'); INSERT INTO t (x) VALUES ('c');";
    expect(splitSqlStatements(input)).toEqual([
      "INSERT INTO t (x) VALUES ('a;b')",
      "INSERT INTO t (x) VALUES ('c')"
    ]);
  });

  it('handles single statement without trailing semicolon', () => {
    expect(splitSqlStatements('SELECT * FROM users')).toEqual(['SELECT * FROM users']);
  });

  it('handles single statement with trailing semicolon', () => {
    expect(splitSqlStatements('SELECT * FROM users;')).toEqual(['SELECT * FROM users']);
  });

  it('handles empty input', () => {
    expect(splitSqlStatements('')).toEqual([]);
  });

  it('handles whitespace only', () => {
    expect(splitSqlStatements('   \n\t  ')).toEqual([]);
  });

  it('handles double quotes', () => {
    const input = 'SELECT "col;name" FROM t; SELECT * FROM t2';
    expect(splitSqlStatements(input)).toEqual([
      'SELECT "col;name" FROM t',
      'SELECT * FROM t2'
    ]);
  });

  it('handles backticks', () => {
    const input = 'SELECT `col;name` FROM t; SELECT * FROM t2';
    expect(splitSqlStatements(input)).toEqual([
      'SELECT `col;name` FROM t',
      'SELECT * FROM t2'
    ]);
  });

  it('handles mixed quotes', () => {
    const input = `INSERT INTO t (a, b) VALUES ('x;y', "z;w"); DELETE FROM t WHERE a = 'test;'`;
    expect(splitSqlStatements(input)).toEqual([
      `INSERT INTO t (a, b) VALUES ('x;y', "z;w")`,
      `DELETE FROM t WHERE a = 'test;'`
    ]);
  });

  it('handles multiple statements', () => {
    const input = 'CREATE TABLE users (id INTEGER); INSERT INTO users (id) VALUES (1); SELECT * FROM users';
    expect(splitSqlStatements(input)).toEqual([
      'CREATE TABLE users (id INTEGER)',
      'INSERT INTO users (id) VALUES (1)',
      'SELECT * FROM users'
    ]);
  });

  it('handles escaped quotes', () => {
    const input = "INSERT INTO t (x) VALUES ('it\\'s a test'); SELECT 1";
    expect(splitSqlStatements(input)).toEqual([
      "INSERT INTO t (x) VALUES ('it\\'s a test')",
      "SELECT 1"
    ]);
  });

  it('handles complex multi-line SQL', () => {
    const input = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      INSERT INTO users (name) VALUES ('Alice'), ('Bob');
      SELECT * FROM users WHERE name LIKE '%ice%';
    `;
    const result = splitSqlStatements(input);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(result[1]).toContain("INSERT INTO users (name) VALUES ('Alice'), ('Bob')");
    expect(result[2]).toContain("SELECT * FROM users WHERE name LIKE '%ice%'");
  });
});
