// SQL Parser - Converts tokens to AST

import { Lexer } from './lexer';
import {
  Token,
  ASTNode,
  CreateTableNode,
  DropTableNode,
  InsertNode,
  SelectNode,
  UpdateNode,
  DeleteNode,
  CreateIndexNode,
  ShowTablesNode,
  DescribeNode,
  ColumnDefinition,
  DataType,
  WhereClause,
  JoinClause,
  OrderByClause,
  SelectColumn,
  AggregateFunction,
} from './types';

export class Parser {
  private tokens: Token[] = [];
  private position: number = 0;

  parse(sql: string): ASTNode {
    const lexer = new Lexer(sql);
    this.tokens = lexer.tokenize();
    this.position = 0;

    const node = this.parseStatement();
    
    // Expect EOF or semicolon
    if (this.current().type !== 'EOF') {
      if (this.current().value === ';') {
        this.advance();
      }
      if (this.current().type !== 'EOF') {
        throw new Error(`Unexpected token: ${this.current().value}`);
      }
    }

    return node;
  }

  private current(): Token {
    return this.tokens[this.position] || { type: 'EOF', value: '', position: -1 };
  }

  private peek(offset: number = 1): Token {
    return this.tokens[this.position + offset] || { type: 'EOF', value: '', position: -1 };
  }

  private advance(): Token {
    return this.tokens[this.position++];
  }

  private expect(type: string, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value.toUpperCase() !== value.toUpperCase())) {
      throw new Error(`Expected ${value || type}, got ${token.value}`);
    }
    return this.advance();
  }

  private match(type: string, value?: string): boolean {
    const token = this.current();
    return token.type === type && (value === undefined || token.value.toUpperCase() === value.toUpperCase());
  }

  private isAggregateFunction(value: string): boolean {
    const upper = value.toUpperCase();
    return ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(upper);
  }

  private parseStatement(): ASTNode {
    const token = this.current();

    if (token.type === 'KEYWORD') {
      switch (token.value) {
        case 'CREATE':
          return this.parseCreate();
        case 'DROP':
          return this.parseDrop();
        case 'INSERT':
          return this.parseInsert();
        case 'SELECT':
          return this.parseSelect();
        case 'UPDATE':
          return this.parseUpdate();
        case 'DELETE':
          return this.parseDelete();
        case 'SHOW':
          return this.parseShow();
        case 'DESCRIBE':
        case 'DESC':
          return this.parseDescribe();
      }
    }

    throw new Error(`Unknown statement: ${token.value}`);
  }

  private parseCreate(): ASTNode {
    this.expect('KEYWORD', 'CREATE');
    
    if (this.match('KEYWORD', 'TABLE')) {
      return this.parseCreateTable();
    }
    if (this.match('KEYWORD', 'INDEX') || this.match('KEYWORD', 'UNIQUE')) {
      return this.parseCreateIndex();
    }

    throw new Error(`Expected TABLE or INDEX after CREATE`);
  }

  private parseCreateTable(): CreateTableNode {
    this.expect('KEYWORD', 'TABLE');
    
    let ifNotExists = false;
    if (this.match('KEYWORD', 'IF')) {
      this.advance();
      this.expect('KEYWORD', 'NOT');
      this.expect('KEYWORD', 'EXISTS');
      ifNotExists = true;
    }

    const tableName = this.expect('IDENTIFIER').value;
    this.expect('PUNCTUATION', '(');

    const columns: ColumnDefinition[] = [];
    
    while (!this.match('PUNCTUATION', ')')) {
      // Handle PRIMARY KEY constraint at table level
      if (this.match('KEYWORD', 'PRIMARY')) {
        this.advance();
        this.expect('KEYWORD', 'KEY');
        this.expect('PUNCTUATION', '(');
        const pkColumn = this.expect('IDENTIFIER').value;
        this.expect('PUNCTUATION', ')');
        
        // Mark the column as primary key
        const col = columns.find(c => c.name === pkColumn);
        if (col) col.primaryKey = true;
        
        if (this.match('PUNCTUATION', ',')) this.advance();
        continue;
      }

      // Handle UNIQUE constraint at table level
      if (this.match('KEYWORD', 'UNIQUE')) {
        this.advance();
        this.expect('PUNCTUATION', '(');
        const uniqueColumn = this.expect('IDENTIFIER').value;
        this.expect('PUNCTUATION', ')');
        
        const col = columns.find(c => c.name === uniqueColumn);
        if (col) col.unique = true;
        
        if (this.match('PUNCTUATION', ',')) this.advance();
        continue;
      }

      columns.push(this.parseColumnDefinition());
      
      if (this.match('PUNCTUATION', ',')) {
        this.advance();
      }
    }

    this.expect('PUNCTUATION', ')');

    return { type: 'CREATE_TABLE', tableName, columns, ifNotExists };
  }

  private parseColumnDefinition(): ColumnDefinition {
    const name = this.expect('IDENTIFIER').value;
    const typeToken = this.expect('KEYWORD');
    
    let type: DataType;
    switch (typeToken.value) {
      case 'INTEGER':
      case 'INT':
        type = 'INTEGER';
        break;
      case 'TEXT':
      case 'VARCHAR':
        type = 'TEXT';
        // Handle VARCHAR(n)
        if (this.match('PUNCTUATION', '(')) {
          this.advance();
          this.expect('NUMBER');
          this.expect('PUNCTUATION', ')');
        }
        break;
      case 'BOOLEAN':
      case 'BOOL':
        type = 'BOOLEAN';
        break;
      case 'REAL':
      case 'FLOAT':
      case 'DOUBLE':
        type = 'REAL';
        break;
      case 'DATE':
      case 'DATETIME':
        type = 'DATE';
        break;
      default:
        throw new Error(`Unknown data type: ${typeToken.value}`);
    }

    const column: ColumnDefinition = { name, type };

    // Parse column constraints
    while (this.current().type === 'KEYWORD') {
      const constraint = this.current().value;
      
      if (constraint === 'PRIMARY') {
        this.advance();
        this.expect('KEYWORD', 'KEY');
        column.primaryKey = true;
        column.notNull = true;
      } else if (constraint === 'UNIQUE') {
        this.advance();
        column.unique = true;
      } else if (constraint === 'NOT') {
        this.advance();
        this.expect('KEYWORD', 'NULL');
        column.notNull = true;
      } else if (constraint === 'DEFAULT') {
        this.advance();
        column.defaultValue = this.parseValue();
      } else if (constraint === 'AUTO_INCREMENT') {
        this.advance();
        column.autoIncrement = true;
      } else {
        break;
      }
    }

    return column;
  }

  private parseDrop(): DropTableNode {
    this.expect('KEYWORD', 'DROP');
    this.expect('KEYWORD', 'TABLE');
    
    let ifExists = false;
    if (this.match('KEYWORD', 'IF')) {
      this.advance();
      this.expect('KEYWORD', 'EXISTS');
      ifExists = true;
    }

    const tableName = this.expect('IDENTIFIER').value;

    return { type: 'DROP_TABLE', tableName, ifExists };
  }

  private parseInsert(): InsertNode {
    this.expect('KEYWORD', 'INSERT');
    this.expect('KEYWORD', 'INTO');
    
    const tableName = this.expect('IDENTIFIER').value;
    
    let columns: string[] | undefined;
    if (this.match('PUNCTUATION', '(')) {
      this.advance();
      columns = [];
      while (!this.match('PUNCTUATION', ')')) {
        columns.push(this.expect('IDENTIFIER').value);
        if (this.match('PUNCTUATION', ',')) this.advance();
      }
      this.expect('PUNCTUATION', ')');
    }

    this.expect('KEYWORD', 'VALUES');
    
    const values: unknown[][] = [];
    do {
      if (this.match('PUNCTUATION', ',')) this.advance();
      
      this.expect('PUNCTUATION', '(');
      const row: unknown[] = [];
      while (!this.match('PUNCTUATION', ')')) {
        row.push(this.parseValue());
        if (this.match('PUNCTUATION', ',')) this.advance();
      }
      this.expect('PUNCTUATION', ')');
      values.push(row);
    } while (this.match('PUNCTUATION', ','));

    return { type: 'INSERT', tableName, columns, values };
  }

  private parseSelect(): SelectNode {
    this.expect('KEYWORD', 'SELECT');
    
    // Check for DISTINCT
    let distinct = false;
    if (this.match('KEYWORD', 'DISTINCT')) {
      this.advance();
      distinct = true;
    }

    // Parse columns
    let columns: SelectColumn[] | '*';
    if (this.match('OPERATOR', '*')) {
      this.advance();
      columns = '*';
    } else {
      columns = [];
      do {
        if (this.match('PUNCTUATION', ',')) this.advance();
        
        const col = this.parseSelectColumn();
        columns.push(col);
      } while (this.match('PUNCTUATION', ','));
    }

    this.expect('KEYWORD', 'FROM');
    const tableName = this.expect('IDENTIFIER').value;

    // Check for table alias
    let tableAlias: string | undefined;
    if (this.match('IDENTIFIER') && !this.isReservedKeyword(this.current().value)) {
      tableAlias = this.advance().value;
    } else if (this.match('KEYWORD', 'AS')) {
      this.advance();
      tableAlias = this.expect('IDENTIFIER').value;
    }

    const node: SelectNode = { type: 'SELECT', columns, tableName, distinct };
    if (tableAlias) node.tableAlias = tableAlias;

    // Parse JOINs
    while (this.match('KEYWORD', 'INNER') || this.match('KEYWORD', 'LEFT') || 
           this.match('KEYWORD', 'RIGHT') || this.match('KEYWORD', 'JOIN')) {
      node.joins = node.joins || [];
      node.joins.push(this.parseJoin());
    }

    // Parse WHERE
    if (this.match('KEYWORD', 'WHERE')) {
      this.advance();
      node.where = this.parseWhere();
    }

    // Parse GROUP BY
    if (this.match('KEYWORD', 'GROUP')) {
      this.advance();
      this.expect('KEYWORD', 'BY');
      node.groupBy = [];
      do {
        if (this.match('PUNCTUATION', ',')) this.advance();
        node.groupBy.push(this.expect('IDENTIFIER').value);
      } while (this.match('PUNCTUATION', ','));
    }

    // Parse HAVING
    if (this.match('KEYWORD', 'HAVING')) {
      this.advance();
      node.having = this.parseHaving();
    }

    // Parse ORDER BY
    if (this.match('KEYWORD', 'ORDER')) {
      this.advance();
      this.expect('KEYWORD', 'BY');
      node.orderBy = [];
      do {
        if (this.match('PUNCTUATION', ',')) this.advance();
        const column = this.expect('IDENTIFIER').value;
        let direction: 'ASC' | 'DESC' = 'ASC';
        if (this.match('KEYWORD', 'ASC')) {
          this.advance();
        } else if (this.match('KEYWORD', 'DESC')) {
          this.advance();
          direction = 'DESC';
        }
        node.orderBy.push({ column, direction });
      } while (this.match('PUNCTUATION', ','));
    }

    // Parse LIMIT
    if (this.match('KEYWORD', 'LIMIT')) {
      this.advance();
      node.limit = parseInt(this.expect('NUMBER').value, 10);
    }

    // Parse OFFSET
    if (this.match('KEYWORD', 'OFFSET')) {
      this.advance();
      node.offset = parseInt(this.expect('NUMBER').value, 10);
    }

    return node;
  }

  private parseSelectColumn(): SelectColumn {
    // Check if this is an aggregate function - support both KEYWORD and IDENTIFIER token types
    const tokenValue = this.current().value.toUpperCase();
    const isAggregate = this.isAggregateFunction(tokenValue);
    const tokenType = this.current().type;
    
    if (isAggregate && (tokenType === 'KEYWORD' || tokenType === 'IDENTIFIER')) {
      const funcName = this.advance().value.toUpperCase() as AggregateFunction;
      this.expect('PUNCTUATION', '(');
      
      let columnName: string;
      let aggregateDistinct = false;
      
      // Check for DISTINCT inside aggregate
      if (this.match('KEYWORD', 'DISTINCT')) {
        this.advance();
        aggregateDistinct = true;
      }
      
      if (this.match('OPERATOR', '*')) {
        this.advance();
        columnName = '*';
      } else {
        // Allow identifier or keyword (for column names that might be reserved)
        const colToken = this.current();
        if (colToken.type === 'IDENTIFIER' || colToken.type === 'KEYWORD') {
          columnName = this.advance().value;
        } else {
          columnName = this.expect('IDENTIFIER').value;
        }
      }
      
      this.expect('PUNCTUATION', ')');
      
      // Check for alias
      let alias: string | undefined;
      if (this.match('KEYWORD', 'AS')) {
        this.advance();
        alias = this.expect('IDENTIFIER').value;
      }
      
      return {
        name: columnName,
        alias: alias || `${funcName.toLowerCase()}_${columnName === '*' ? 'all' : columnName}`,
        aggregate: {
          function: funcName,
          column: columnName,
          alias,
          distinct: aggregateDistinct,
        },
      };
    }

    // Regular column
    let tableName: string | undefined;
    let colName = this.expect('IDENTIFIER').value;
    
    if (this.match('PUNCTUATION', '.')) {
      this.advance();
      tableName = colName;
      colName = this.expect('IDENTIFIER').value;
    }
    
    // Check for alias
    let alias: string | undefined;
    if (this.match('KEYWORD', 'AS')) {
      this.advance();
      alias = this.expect('IDENTIFIER').value;
    }
    
    const result: SelectColumn = { name: colName };
    if (alias) result.alias = alias;
    if (tableName) result.tableName = tableName;
    
    return result;
  }

  private isReservedKeyword(value: string): boolean {
    const reserved = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'JOIN', 'INNER', 'LEFT', 'RIGHT',
      'ON', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'GROUP', 'HAVING',
      'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'DROP',
      'TABLE', 'INDEX', 'IF', 'EXISTS', 'NOT', 'NULL', 'PRIMARY', 'KEY', 'UNIQUE',
      'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'LIKE',
    ];
    return reserved.includes(value.toUpperCase());
  }

  private parseJoin(): JoinClause {
    let type: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER';
    
    if (this.match('KEYWORD', 'INNER')) {
      this.advance();
    } else if (this.match('KEYWORD', 'LEFT')) {
      this.advance();
      type = 'LEFT';
      if (this.match('KEYWORD', 'OUTER')) this.advance();
    } else if (this.match('KEYWORD', 'RIGHT')) {
      this.advance();
      type = 'RIGHT';
      if (this.match('KEYWORD', 'OUTER')) this.advance();
    }

    this.expect('KEYWORD', 'JOIN');
    const tableName = this.expect('IDENTIFIER').value;
    
    let alias: string | undefined;
    if (this.match('KEYWORD', 'AS')) {
      this.advance();
      alias = this.expect('IDENTIFIER').value;
    } else if (this.match('IDENTIFIER') && !this.isReservedKeyword(this.current().value)) {
      alias = this.advance().value;
    }

    this.expect('KEYWORD', 'ON');
    
    const leftColumn = this.expect('IDENTIFIER').value + 
      (this.match('PUNCTUATION', '.') ? (this.advance(), '.' + this.expect('IDENTIFIER').value) : '');
    
    this.expect('OPERATOR', '=');
    
    const rightColumn = this.expect('IDENTIFIER').value + 
      (this.match('PUNCTUATION', '.') ? (this.advance(), '.' + this.expect('IDENTIFIER').value) : '');

    return { type, tableName, alias, on: { leftColumn, rightColumn } };
  }

  private parseUpdate(): UpdateNode {
    this.expect('KEYWORD', 'UPDATE');
    const tableName = this.expect('IDENTIFIER').value;
    this.expect('KEYWORD', 'SET');

    const set: Record<string, unknown> = {};
    do {
      if (this.match('PUNCTUATION', ',')) this.advance();
      const column = this.expect('IDENTIFIER').value;
      this.expect('OPERATOR', '=');
      set[column] = this.parseValue();
    } while (this.match('PUNCTUATION', ','));

    const node: UpdateNode = { type: 'UPDATE', tableName, set };

    if (this.match('KEYWORD', 'WHERE')) {
      this.advance();
      node.where = this.parseWhere();
    }

    return node;
  }

  private parseDelete(): DeleteNode {
    this.expect('KEYWORD', 'DELETE');
    this.expect('KEYWORD', 'FROM');
    const tableName = this.expect('IDENTIFIER').value;

    const node: DeleteNode = { type: 'DELETE', tableName };

    if (this.match('KEYWORD', 'WHERE')) {
      this.advance();
      node.where = this.parseWhere();
    }

    return node;
  }

  private parseCreateIndex(): CreateIndexNode {
    let unique = false;
    if (this.match('KEYWORD', 'UNIQUE')) {
      this.advance();
      unique = true;
    }

    this.expect('KEYWORD', 'INDEX');
    const indexName = this.expect('IDENTIFIER').value;
    this.expect('KEYWORD', 'ON');
    const tableName = this.expect('IDENTIFIER').value;
    
    this.expect('PUNCTUATION', '(');
    const columns: string[] = [];
    do {
      if (this.match('PUNCTUATION', ',')) this.advance();
      columns.push(this.expect('IDENTIFIER').value);
    } while (this.match('PUNCTUATION', ','));
    this.expect('PUNCTUATION', ')');

    return { type: 'CREATE_INDEX', indexName, tableName, columns, unique };
  }

  private parseShow(): ShowTablesNode {
    this.expect('KEYWORD', 'SHOW');
    this.expect('KEYWORD', 'TABLES');
    return { type: 'SHOW_TABLES' };
  }

  private parseDescribe(): DescribeNode {
    this.advance(); // DESCRIBE or DESC
    const tableName = this.expect('IDENTIFIER').value;
    return { type: 'DESCRIBE', tableName };
  }

  private parseWhere(): WhereClause {
    return this.parseOr();
  }

  private parseHaving(): WhereClause {
    // HAVING can reference aliases, so we use a simplified parser
    // For now, we'll parse it similarly to WHERE but allow identifiers to be aliases
    return this.parseHavingOr();
  }

  private parseHavingOr(): WhereClause {
    let left = this.parseHavingAnd();

    while (this.match('KEYWORD', 'OR')) {
      this.advance();
      const right = this.parseHavingAnd();
      left = { operator: 'OR', left, right };
    }

    return left;
  }

  private parseHavingAnd(): WhereClause {
    let left = this.parseHavingComparison();

    while (this.match('KEYWORD', 'AND')) {
      this.advance();
      const right = this.parseHavingComparison();
      left = { operator: 'AND', left, right };
    }

    return left;
  }

  private parseHavingComparison(): WhereClause {
    const column = this.expect('IDENTIFIER').value;
    
    const operatorToken = this.advance();
    const comparison = operatorToken.value as '=' | '!=' | '<' | '>' | '<=' | '>=';
    const value = this.parseValue();

    return { operator: 'COMPARISON', left: column, right: value, comparison };
  }

  private parseOr(): WhereClause {
    let left = this.parseAnd();

    while (this.match('KEYWORD', 'OR')) {
      this.advance();
      const right = this.parseAnd();
      left = { operator: 'OR', left, right };
    }

    return left;
  }

  private parseAnd(): WhereClause {
    let left = this.parseComparison();

    while (this.match('KEYWORD', 'AND')) {
      this.advance();
      const right = this.parseComparison();
      left = { operator: 'AND', left, right };
    }

    return left;
  }

  private parseComparison(): WhereClause {
    const column = this.expect('IDENTIFIER').value;
    
    // Handle IS NULL / IS NOT NULL
    if (this.match('KEYWORD', 'IS')) {
      this.advance();
      if (this.match('KEYWORD', 'NOT')) {
        this.advance();
        this.expect('KEYWORD', 'NULL');
        return { operator: 'COMPARISON', left: column, comparison: 'IS NOT NULL' };
      }
      this.expect('KEYWORD', 'NULL');
      return { operator: 'COMPARISON', left: column, comparison: 'IS NULL' };
    }

    // Handle NOT LIKE
    if (this.match('KEYWORD', 'NOT')) {
      this.advance();
      if (this.match('KEYWORD', 'LIKE')) {
        this.advance();
        const pattern = this.parseValue();
        return { operator: 'COMPARISON', left: column, right: pattern, comparison: 'NOT LIKE' };
      }
      throw new Error('Expected LIKE after NOT');
    }

    // Handle LIKE
    if (this.match('KEYWORD', 'LIKE')) {
      this.advance();
      const pattern = this.parseValue();
      return { operator: 'COMPARISON', left: column, right: pattern, comparison: 'LIKE' };
    }

    const operatorToken = this.advance();
    const comparison = operatorToken.value as '=' | '!=' | '<' | '>' | '<=' | '>=';
    const value = this.parseValue();

    return { operator: 'COMPARISON', left: column, right: value, comparison };
  }

  private parseValue(): unknown {
    const token = this.current();

    if (token.type === 'STRING') {
      this.advance();
      return token.value;
    }

    if (token.type === 'NUMBER') {
      this.advance();
      return token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value, 10);
    }

    if (token.type === 'KEYWORD') {
      if (token.value === 'TRUE') {
        this.advance();
        return true;
      }
      if (token.value === 'FALSE') {
        this.advance();
        return false;
      }
      if (token.value === 'NULL') {
        this.advance();
        return null;
      }
    }

    throw new Error(`Expected value, got ${token.value}`);
  }
}
