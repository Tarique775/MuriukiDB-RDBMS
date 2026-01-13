// SQL Query Executor

import { supabase } from '@/integrations/supabase/client';
import { Parser } from './parser';
import { BTree } from './btree';
import {
  ASTNode,
  QueryResult,
  TableSchema,
  Row,
  ColumnDefinition,
  WhereClause,
  CreateTableNode,
  InsertNode,
  SelectNode,
  UpdateNode,
  DeleteNode,
  DropTableNode,
  CreateIndexNode,
  ShowTablesNode,
  DescribeNode,
  IndexDefinition,
} from './types';
import { Json } from '@/integrations/supabase/types';

// In-memory index cache
const indexCache: Map<string, BTree<unknown>> = new Map();

// Resource limits to prevent abuse
const RESOURCE_LIMITS = {
  MAX_TABLES: 50,
  MAX_ROWS_PER_TABLE: 10000,
  QUERY_TIMEOUT_MS: 5000,
  MAX_QUERIES_PER_MINUTE: 30,
};

// Rate limiting state
let queryCount = 0;
let windowStart = Date.now();

export class QueryExecutor {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  private checkRateLimit(): void {
    const now = Date.now();
    if (now - windowStart > 60000) {
      queryCount = 0;
      windowStart = now;
    }
    
    if (queryCount >= RESOURCE_LIMITS.MAX_QUERIES_PER_MINUTE) {
      throw new Error(`Rate limit exceeded (${RESOURCE_LIMITS.MAX_QUERIES_PER_MINUTE} queries/minute). Please wait.`);
    }
    
    queryCount++;
  }

  async execute(sql: string): Promise<QueryResult> {
    const startTime = performance.now();
    
    try {
      // Check rate limit
      this.checkRateLimit();
      
      const ast = this.parser.parse(sql);
      
      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout (${RESOURCE_LIMITS.QUERY_TIMEOUT_MS / 1000}s limit)`)), RESOURCE_LIMITS.QUERY_TIMEOUT_MS)
      );
      
      const result = await Promise.race([
        this.executeNode(ast),
        timeoutPromise
      ]);
      
      result.executionTime = Math.round(performance.now() - startTime);
      
      // Log query to history
      await this.logQuery(sql, result);
      
      return result;
    } catch (error) {
      const errorResult: QueryResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Math.round(performance.now() - startTime),
      };
      
      await this.logQuery(sql, errorResult);
      
      return errorResult;
    }
  }

  private async executeNode(node: ASTNode): Promise<QueryResult> {
    switch (node.type) {
      case 'CREATE_TABLE':
        return this.executeCreateTable(node);
      case 'DROP_TABLE':
        return this.executeDropTable(node);
      case 'INSERT':
        return this.executeInsert(node);
      case 'SELECT':
        return this.executeSelect(node);
      case 'UPDATE':
        return this.executeUpdate(node);
      case 'DELETE':
        return this.executeDelete(node);
      case 'CREATE_INDEX':
        return this.executeCreateIndex(node);
      case 'SHOW_TABLES':
        return this.executeShowTables(node);
      case 'DESCRIBE':
        return this.executeDescribe(node);
      default:
        throw new Error(`Unknown node type`);
    }
  }

  private async executeCreateTable(node: CreateTableNode): Promise<QueryResult> {
    // Check table limit to prevent resource exhaustion
    const { count: tableCount } = await supabase
      .from('rdbms_tables')
      .select('*', { count: 'exact', head: true });

    if (tableCount !== null && tableCount >= RESOURCE_LIMITS.MAX_TABLES) {
      throw new Error(`Maximum table limit reached (${RESOURCE_LIMITS.MAX_TABLES} tables). Drop unused tables first.`);
    }

    // Check if table exists
    const { data: existing } = await supabase
      .from('rdbms_tables')
      .select('id')
      .eq('table_name', node.tableName)
      .maybeSingle();

    if (existing) {
      if (node.ifNotExists) {
        return { success: true, message: `Table ${node.tableName} already exists` };
      }
      throw new Error(`Table ${node.tableName} already exists`);
    }

    // Validate columns
    const hasPrimaryKey = node.columns.some(c => c.primaryKey);
    if (!hasPrimaryKey) {
      // Add implicit id column
      node.columns.unshift({
        name: 'id',
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true,
        notNull: true,
      });
    }

    // Create table
    const { error } = await supabase.from('rdbms_tables').insert({
      table_name: node.tableName,
      columns: node.columns as unknown as Json,
      indexes: [] as unknown as Json,
    });

    if (error) throw new Error(error.message);

    return {
      success: true,
      message: `Table ${node.tableName} created successfully`,
    };
  }

  private async executeDropTable(node: DropTableNode): Promise<QueryResult> {
    const { data: table } = await supabase
      .from('rdbms_tables')
      .select('id')
      .eq('table_name', node.tableName)
      .maybeSingle();

    if (!table) {
      if (node.ifExists) {
        return { success: true, message: `Table ${node.tableName} does not exist` };
      }
      throw new Error(`Table ${node.tableName} does not exist`);
    }

    // Delete table (cascade will delete rows)
    const { error } = await supabase
      .from('rdbms_tables')
      .delete()
      .eq('id', table.id);

    if (error) throw new Error(error.message);

    // Clear any cached indexes
    for (const key of indexCache.keys()) {
      if (key.startsWith(`${node.tableName}:`)) {
        indexCache.delete(key);
      }
    }

    return {
      success: true,
      message: `Table ${node.tableName} dropped successfully`,
    };
  }

  private async executeInsert(node: InsertNode): Promise<QueryResult> {
    const table = await this.getTable(node.tableName);
    const columns = table.columns as ColumnDefinition[];

    // Check row limit per table to prevent storage exhaustion
    const { count: rowCount } = await supabase
      .from('rdbms_rows')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', table.id);

    const rowsToInsert = node.values.length;
    if (rowCount !== null && rowCount + rowsToInsert > RESOURCE_LIMITS.MAX_ROWS_PER_TABLE) {
      throw new Error(`Maximum row limit reached for this table (${RESOURCE_LIMITS.MAX_ROWS_PER_TABLE} rows). Delete some rows first.`);
    }
    
    // Get next auto-increment value
    let autoIncrementValue = 1;
    const autoIncrementCol = columns.find(c => c.autoIncrement);
    if (autoIncrementCol) {
      const { data: rows } = await supabase
        .from('rdbms_rows')
        .select('data')
        .eq('table_id', table.id);
      
      if (rows && rows.length > 0) {
        const maxVal = Math.max(...rows.map(r => {
          const data = r.data as Record<string, unknown>;
          return (data[autoIncrementCol.name] as number) || 0;
        }));
        autoIncrementValue = maxVal + 1;
      }
    }

    const insertedRows: Record<string, unknown>[] = [];

    for (const values of node.values) {
      const rowData: Record<string, unknown> = {};
      const insertColumns = node.columns || columns.map(c => c.name);

      // Validate column count
      if (values.length !== insertColumns.length) {
        throw new Error(`Column count doesn't match value count`);
      }

      // Build row data
      for (let i = 0; i < insertColumns.length; i++) {
        const colName = insertColumns[i];
        const colDef = columns.find(c => c.name === colName);
        if (!colDef) {
          throw new Error(`Unknown column: ${colName}`);
        }
        
        const value = values[i];
        rowData[colName] = this.validateAndConvertValue(value, colDef);
      }

      // Handle auto-increment
      if (autoIncrementCol && !(autoIncrementCol.name in rowData)) {
        rowData[autoIncrementCol.name] = autoIncrementValue++;
      }

      // Check NOT NULL constraints
      for (const col of columns) {
        if (col.notNull && !col.autoIncrement && !(col.name in rowData)) {
          if (col.defaultValue !== undefined) {
            rowData[col.name] = col.defaultValue;
          } else {
            throw new Error(`Column ${col.name} cannot be NULL`);
          }
        }
      }

      // Check UNIQUE constraints
      for (const col of columns) {
        if (col.unique || col.primaryKey) {
          const { data: existing } = await supabase
            .from('rdbms_rows')
            .select('id')
            .eq('table_id', table.id)
            .limit(1);

          if (existing) {
            for (const row of existing) {
              const { data: rowData2 } = await supabase
                .from('rdbms_rows')
                .select('data')
                .eq('id', row.id)
                .single();
              
              if (rowData2) {
                const existingData = rowData2.data as Record<string, unknown>;
                if (existingData[col.name] === rowData[col.name]) {
                  throw new Error(`Duplicate value for unique column ${col.name}`);
                }
              }
            }
          }
        }
      }

      const { error } = await supabase.from('rdbms_rows').insert({
        table_id: table.id,
        data: rowData as unknown as Json,
      });

      if (error) throw new Error(error.message);
      insertedRows.push(rowData);
    }

    return {
      success: true,
      message: `${insertedRows.length} row(s) inserted`,
      rowCount: insertedRows.length,
      rows: insertedRows,
    };
  }

  private async executeSelect(node: SelectNode): Promise<QueryResult> {
    const table = await this.getTable(node.tableName);
    const columns = table.columns as ColumnDefinition[];

    // Get all rows for main table
    let { data: rows } = await supabase
      .from('rdbms_rows')
      .select('*')
      .eq('table_id', table.id);

    if (!rows) rows = [];

    // Handle JOINs
    if (node.joins && node.joins.length > 0) {
      for (const join of node.joins) {
        const joinTable = await this.getTable(join.tableName);
        const { data: joinRows } = await supabase
          .from('rdbms_rows')
          .select('*')
          .eq('table_id', joinTable.id);

        if (!joinRows) continue;

        const newRows: typeof rows = [];
        const [leftTable, leftCol] = join.on.leftColumn.includes('.')
          ? join.on.leftColumn.split('.')
          : [node.tableName, join.on.leftColumn];
        const [rightTable, rightCol] = join.on.rightColumn.includes('.')
          ? join.on.rightColumn.split('.')
          : [join.tableName, join.on.rightColumn];

        for (const row of rows) {
          const rowData = row.data as Record<string, unknown>;
          const leftValue = leftTable === node.tableName ? rowData[leftCol] : rowData[`${leftTable}.${leftCol}`];
          
          let matched = false;
          for (const joinRow of joinRows) {
            const joinData = joinRow.data as Record<string, unknown>;
            const rightValue = rightTable === join.tableName ? joinData[rightCol] : joinData[`${rightTable}.${rightCol}`];

            if (leftValue === rightValue) {
              matched = true;
              // Merge row data with prefixes
              const mergedData: Record<string, unknown> = { ...rowData };
              for (const [key, value] of Object.entries(joinData)) {
                mergedData[`${join.alias || join.tableName}.${key}`] = value;
              }
              newRows.push({ ...row, data: mergedData as unknown as Json });
            }
          }

          // For LEFT JOIN, include unmatched rows
          if (!matched && join.type === 'LEFT') {
            const nullData: Record<string, unknown> = { ...rowData };
            const joinCols = joinTable.columns as ColumnDefinition[];
            for (const col of joinCols) {
              nullData[`${join.alias || join.tableName}.${col.name}`] = null;
            }
            newRows.push({ ...row, data: nullData as unknown as Json });
          }
        }

        rows = newRows;
      }
    }

    // Apply WHERE filter
    if (node.where) {
      rows = rows.filter(row => this.evaluateWhere(row.data as Record<string, unknown>, node.where!));
    }

    // Apply ORDER BY
    if (node.orderBy && node.orderBy.length > 0) {
      rows.sort((a, b) => {
        const aData = a.data as Record<string, unknown>;
        const bData = b.data as Record<string, unknown>;
        
        for (const order of node.orderBy!) {
          const aVal = aData[order.column];
          const bVal = bData[order.column];
          
          let cmp = 0;
          if (aVal < bVal) cmp = -1;
          else if (aVal > bVal) cmp = 1;
          
          if (cmp !== 0) {
            return order.direction === 'DESC' ? -cmp : cmp;
          }
        }
        return 0;
      });
    }

    // Apply OFFSET
    if (node.offset) {
      rows = rows.slice(node.offset);
    }

    // Apply LIMIT
    if (node.limit) {
      rows = rows.slice(0, node.limit);
    }

    // Project columns
    let resultColumns: string[];
    if (node.columns === '*') {
      resultColumns = columns.map(c => c.name);
    } else {
      resultColumns = node.columns;
    }

    const resultRows = rows.map(row => {
      const data = row.data as Record<string, unknown>;
      const projected: Record<string, unknown> = {};
      
      for (const col of resultColumns) {
        if (col.includes('.')) {
          projected[col] = data[col];
        } else {
          projected[col] = data[col];
        }
      }
      
      return projected;
    });

    return {
      success: true,
      rows: resultRows,
      rowCount: resultRows.length,
      columns: resultColumns,
    };
  }

  private async executeUpdate(node: UpdateNode): Promise<QueryResult> {
    const table = await this.getTable(node.tableName);
    const columns = table.columns as ColumnDefinition[];

    // Get rows to update
    let { data: rows } = await supabase
      .from('rdbms_rows')
      .select('*')
      .eq('table_id', table.id);

    if (!rows) rows = [];

    // Filter by WHERE
    const toUpdate = node.where
      ? rows.filter(row => this.evaluateWhere(row.data as Record<string, unknown>, node.where!))
      : rows;

    // Update each row
    let updateCount = 0;
    for (const row of toUpdate) {
      const data = { ...(row.data as Record<string, unknown>) };
      
      for (const [colName, value] of Object.entries(node.set)) {
        const colDef = columns.find(c => c.name === colName);
        if (!colDef) {
          throw new Error(`Unknown column: ${colName}`);
        }
        data[colName] = this.validateAndConvertValue(value, colDef);
      }

      const { error } = await supabase
        .from('rdbms_rows')
        .update({ data: data as unknown as Json })
        .eq('id', row.id);

      if (error) throw new Error(error.message);
      updateCount++;
    }

    return {
      success: true,
      message: `${updateCount} row(s) updated`,
      rowCount: updateCount,
    };
  }

  private async executeDelete(node: DeleteNode): Promise<QueryResult> {
    const table = await this.getTable(node.tableName);

    // Get rows to delete
    let { data: rows } = await supabase
      .from('rdbms_rows')
      .select('*')
      .eq('table_id', table.id);

    if (!rows) rows = [];

    // Filter by WHERE
    const toDelete = node.where
      ? rows.filter(row => this.evaluateWhere(row.data as Record<string, unknown>, node.where!))
      : rows;

    // Delete each row
    for (const row of toDelete) {
      const { error } = await supabase
        .from('rdbms_rows')
        .delete()
        .eq('id', row.id);

      if (error) throw new Error(error.message);
    }

    return {
      success: true,
      message: `${toDelete.length} row(s) deleted`,
      rowCount: toDelete.length,
    };
  }

  private async executeCreateIndex(node: CreateIndexNode): Promise<QueryResult> {
    const table = await this.getTable(node.tableName);
    const indexes = (table.indexes as IndexDefinition[]) || [];

    // Check if index already exists
    if (indexes.some(idx => idx.name === node.indexName)) {
      throw new Error(`Index ${node.indexName} already exists`);
    }

    // Validate columns
    const columns = table.columns as ColumnDefinition[];
    for (const col of node.columns) {
      if (!columns.some(c => c.name === col)) {
        throw new Error(`Unknown column: ${col}`);
      }
    }

    // Add index to table
    const newIndex: IndexDefinition = {
      name: node.indexName,
      columns: node.columns,
      unique: node.unique,
    };
    indexes.push(newIndex);

    const { error } = await supabase
      .from('rdbms_tables')
      .update({ indexes: indexes as unknown as Json })
      .eq('id', table.id);

    if (error) throw new Error(error.message);

    // Build the index in memory
    await this.buildIndex(table.id, node.tableName, newIndex);

    return {
      success: true,
      message: `Index ${node.indexName} created on ${node.tableName}(${node.columns.join(', ')})`,
    };
  }

  private async buildIndex(tableId: string, tableName: string, index: IndexDefinition): Promise<void> {
    const { data: rows } = await supabase
      .from('rdbms_rows')
      .select('*')
      .eq('table_id', tableId);

    if (!rows) return;

    const tree = new BTree<unknown>();
    
    for (const row of rows) {
      const data = row.data as Record<string, unknown>;
      // Create composite key for multi-column indexes
      const key = index.columns.length === 1
        ? data[index.columns[0]]
        : JSON.stringify(index.columns.map(c => data[c]));
      
      tree.insert(key, row.id);
    }

    indexCache.set(`${tableName}:${index.name}`, tree);
  }

  private async executeShowTables(_node: ShowTablesNode): Promise<QueryResult> {
    const { data: tables, error } = await supabase
      .from('rdbms_tables')
      .select('table_name, created_at')
      .order('table_name');

    if (error) throw new Error(error.message);

    return {
      success: true,
      rows: tables?.map(t => ({ table_name: t.table_name, created_at: t.created_at })) || [],
      rowCount: tables?.length || 0,
      columns: ['table_name', 'created_at'],
    };
  }

  private async executeDescribe(node: DescribeNode): Promise<QueryResult> {
    const table = await this.getTable(node.tableName);
    const columns = table.columns as ColumnDefinition[];
    const indexes = (table.indexes as IndexDefinition[]) || [];

    const rows = columns.map(col => ({
      column_name: col.name,
      data_type: col.type,
      nullable: col.notNull ? 'NO' : 'YES',
      key: col.primaryKey ? 'PRI' : col.unique ? 'UNI' : '',
      default: col.defaultValue ?? null,
      extra: col.autoIncrement ? 'auto_increment' : '',
    }));

    return {
      success: true,
      rows,
      rowCount: rows.length,
      columns: ['column_name', 'data_type', 'nullable', 'key', 'default', 'extra'],
      message: indexes.length > 0 
        ? `Indexes: ${indexes.map(i => `${i.name}(${i.columns.join(', ')})`).join(', ')}`
        : undefined,
    };
  }

  private async getTable(tableName: string): Promise<TableSchema> {
    const { data, error } = await supabase
      .from('rdbms_tables')
      .select('*')
      .eq('table_name', tableName)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Table ${tableName} does not exist`);

    return {
      id: data.id,
      tableName: data.table_name,
      columns: data.columns as unknown as ColumnDefinition[],
      indexes: data.indexes as unknown as IndexDefinition[],
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  private validateAndConvertValue(value: unknown, column: ColumnDefinition): unknown {
    if (value === null) {
      if (column.notNull) {
        throw new Error(`Column ${column.name} cannot be NULL`);
      }
      return null;
    }

    switch (column.type) {
      case 'INTEGER':
        const intVal = typeof value === 'number' ? Math.floor(value) : parseInt(String(value), 10);
        if (isNaN(intVal)) throw new Error(`Invalid integer value for ${column.name}`);
        return intVal;
      
      case 'REAL':
        const realVal = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(realVal)) throw new Error(`Invalid real value for ${column.name}`);
        return realVal;
      
      case 'TEXT':
        return String(value);
      
      case 'BOOLEAN':
        if (typeof value === 'boolean') return value;
        if (value === 'true' || value === 1) return true;
        if (value === 'false' || value === 0) return false;
        throw new Error(`Invalid boolean value for ${column.name}`);
      
      case 'DATE':
        const dateVal = new Date(String(value));
        if (isNaN(dateVal.getTime())) throw new Error(`Invalid date value for ${column.name}`);
        return dateVal.toISOString();
      
      default:
        return value;
    }
  }

  private evaluateWhere(data: Record<string, unknown>, where: WhereClause): boolean {
    if (where.operator === 'AND') {
      return (
        this.evaluateWhere(data, where.left as WhereClause) &&
        this.evaluateWhere(data, where.right as WhereClause)
      );
    }

    if (where.operator === 'OR') {
      return (
        this.evaluateWhere(data, where.left as WhereClause) ||
        this.evaluateWhere(data, where.right as WhereClause)
      );
    }

    // COMPARISON
    const column = where.left as string;
    const value = data[column];
    const compareValue = where.right;

    switch (where.comparison) {
      case '=':
        return value === compareValue;
      case '!=':
        return value !== compareValue;
      case '<':
        return (value as number) < (compareValue as number);
      case '>':
        return (value as number) > (compareValue as number);
      case '<=':
        return (value as number) <= (compareValue as number);
      case '>=':
        return (value as number) >= (compareValue as number);
      case 'LIKE':
        const pattern = String(compareValue)
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        return new RegExp(`^${pattern}$`, 'i').test(String(value));
      case 'IS NULL':
        return value === null || value === undefined;
      case 'IS NOT NULL':
        return value !== null && value !== undefined;
      default:
        return false;
    }
  }

  private async logQuery(sql: string, result: QueryResult): Promise<void> {
    try {
      await supabase.from('rdbms_query_history').insert({
        query: sql,
        result: result as unknown as Json,
        success: result.success,
        execution_time_ms: result.executionTime,
      });
    } catch {
      // Ignore logging errors
    }
  }
}