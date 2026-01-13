// SQL Lexer - Tokenizes SQL input

import { Token, TokenType } from './types';

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'DROP', 'INDEX', 'ON', 'PRIMARY', 'KEY',
  'UNIQUE', 'NOT', 'NULL', 'DEFAULT', 'AUTO_INCREMENT', 'INTEGER', 'INT',
  'TEXT', 'VARCHAR', 'BOOLEAN', 'BOOL', 'REAL', 'FLOAT', 'DOUBLE', 'DATE',
  'DATETIME', 'AND', 'OR', 'LIKE', 'IN', 'BETWEEN', 'IS', 'AS', 'JOIN',
  'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT',
  'OFFSET', 'IF', 'EXISTS', 'SHOW', 'TABLES', 'DESCRIBE', 'DESC', 'TRUE',
  'FALSE', 'CONSTRAINT', 'FOREIGN', 'REFERENCES'
]);

const OPERATORS = new Set(['=', '!=', '<>', '<', '>', '<=', '>=', '+', '-', '*', '/']);
const PUNCTUATION = new Set(['(', ')', ',', ';', '.']);

export class Lexer {
  private input: string;
  private position: number = 0;
  private tokens: Token[] = [];

  constructor(input: string) {
    this.input = input.trim();
  }

  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;

    while (this.position < this.input.length) {
      const char = this.input[this.position];

      // Skip whitespace
      if (/\s/.test(char)) {
        this.position++;
        continue;
      }

      // Single-line comment
      if (char === '-' && this.input[this.position + 1] === '-') {
        while (this.position < this.input.length && this.input[this.position] !== '\n') {
          this.position++;
        }
        continue;
      }

      // String literals
      if (char === "'" || char === '"') {
        this.tokens.push(this.readString(char));
        continue;
      }

      // Numbers
      if (/\d/.test(char) || (char === '.' && /\d/.test(this.input[this.position + 1]))) {
        this.tokens.push(this.readNumber());
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_]/.test(char)) {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      // Multi-character operators
      if (char === '!' && this.input[this.position + 1] === '=') {
        this.tokens.push({ type: 'OPERATOR', value: '!=', position: this.position });
        this.position += 2;
        continue;
      }
      if (char === '<' && this.input[this.position + 1] === '>') {
        this.tokens.push({ type: 'OPERATOR', value: '!=', position: this.position });
        this.position += 2;
        continue;
      }
      if (char === '<' && this.input[this.position + 1] === '=') {
        this.tokens.push({ type: 'OPERATOR', value: '<=', position: this.position });
        this.position += 2;
        continue;
      }
      if (char === '>' && this.input[this.position + 1] === '=') {
        this.tokens.push({ type: 'OPERATOR', value: '>=', position: this.position });
        this.position += 2;
        continue;
      }

      // Single-character operators
      if (OPERATORS.has(char)) {
        this.tokens.push({ type: 'OPERATOR', value: char, position: this.position });
        this.position++;
        continue;
      }

      // Punctuation
      if (PUNCTUATION.has(char)) {
        this.tokens.push({ type: 'PUNCTUATION', value: char, position: this.position });
        this.position++;
        continue;
      }

      throw new Error(`Unexpected character '${char}' at position ${this.position}`);
    }

    this.tokens.push({ type: 'EOF', value: '', position: this.position });
    return this.tokens;
  }

  private readString(quote: string): Token {
    const start = this.position;
    this.position++; // Skip opening quote
    let value = '';

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      if (char === quote) {
        // Check for escaped quote
        if (this.input[this.position + 1] === quote) {
          value += quote;
          this.position += 2;
          continue;
        }
        this.position++; // Skip closing quote
        return { type: 'STRING', value, position: start };
      }
      
      value += char;
      this.position++;
    }

    throw new Error(`Unterminated string starting at position ${start}`);
  }

  private readNumber(): Token {
    const start = this.position;
    let value = '';
    let hasDecimal = false;

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      if (/\d/.test(char)) {
        value += char;
        this.position++;
      } else if (char === '.' && !hasDecimal) {
        hasDecimal = true;
        value += char;
        this.position++;
      } else {
        break;
      }
    }

    return { type: 'NUMBER', value, position: start };
  }

  private readIdentifier(): Token {
    const start = this.position;
    let value = '';

    while (this.position < this.input.length) {
      const char = this.input[this.position];
      
      if (/[a-zA-Z0-9_]/.test(char)) {
        value += char;
        this.position++;
      } else {
        break;
      }
    }

    const upperValue = value.toUpperCase();
    const type: TokenType = SQL_KEYWORDS.has(upperValue) ? 'KEYWORD' : 'IDENTIFIER';
    
    return { type, value: type === 'KEYWORD' ? upperValue : value, position: start };
  }
}

// HTML escape function to prevent XSS attacks
const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&#039;');

// Syntax highlighter for SQL
export function highlightSQL(sql: string): string {
  const lexer = new Lexer(sql);
  let highlighted = '';
  let lastPosition = 0;

  try {
    const tokens = lexer.tokenize();

    for (const token of tokens) {
      if (token.type === 'EOF') break;

      // Add any whitespace before this token (escaped)
      while (lastPosition < token.position) {
        highlighted += escapeHtml(sql[lastPosition]);
        lastPosition++;
      }

      // Determine the original text length
      let originalText = token.value;
      if (token.type === 'STRING') {
        originalText = `'${token.value}'`;
      }

      // Apply syntax highlighting with HTML escaping
      switch (token.type) {
        case 'KEYWORD':
          highlighted += `<span class="sql-keyword">${escapeHtml(originalText)}</span>`;
          break;
        case 'STRING':
          highlighted += `<span class="sql-string">'${escapeHtml(token.value)}'</span>`;
          break;
        case 'NUMBER':
          highlighted += `<span class="sql-number">${escapeHtml(originalText)}</span>`;
          break;
        case 'IDENTIFIER':
          highlighted += `<span class="sql-table">${escapeHtml(originalText)}</span>`;
          break;
        default:
          highlighted += escapeHtml(originalText);
      }

      lastPosition = token.position + originalText.length;
    }

    // Add any remaining text (escaped)
    while (lastPosition < sql.length) {
      highlighted += escapeHtml(sql[lastPosition]);
      lastPosition++;
    }
  } catch {
    // If tokenization fails, return escaped plain text
    return escapeHtml(sql);
  }

  return highlighted;
}