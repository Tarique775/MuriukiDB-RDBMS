// SQL Query Executor

import { supabase } from '@/integrations/supabase/client';
import { Parser } from './parser';
import { BTree } from './btree';
import {
  ASTNode,
  QueryResult,
  TableSchema,
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
  SelectColumn,
} from './types';
import { Json } from '@/integrations/supabase/types';
import { getCachedUserId, getCachedAccessToken } from '@/lib/auth/sessionCache';

// In-memory index cache
const indexCache: Map<string, BTree<unknown>> = new Map();

// Session key for tracking anonymous users
const SESSION_KEY = 'muriukidb-session-id';

export function getOrCreateSessionId(): string {
  // Use localStorage for persistence across browser sessions
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// Get user context for RLS compliance - uses cached session to avoid refresh storms
function getUserContext(): { userId: string | null; sessionId: string } {
  const sessionId = getOrCreateSessionId();
  return {
    userId: getCachedUserId(),
    sessionId,
  };
}

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
let serverRateLimitRemaining = 30;
let isServerRateLimitActive = false;

// Server-side rate limit check - uses cached token to avoid refresh storms
async function checkServerRateLimit(): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  try {
    const accessToken = getCachedAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sql-execute`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: 'rate-limit-check' }),
      }
    );

    if (response.status === 429) {
      const data = await response.json();
      return { 
        allowed: false, 
        remaining: 0, 
        retryAfter: data.retryAfter || 60 
      };
    }

    const data = await response.json();
    serverRateLimitRemaining = data.remaining || 30;
    isServerRateLimitActive = true;
    return { allowed: true, remaining: data.remaining || 30 };
  } catch (error) {
    console.warn('Server rate limit check failed, using client-side fallback');
    isServerRateLimitActive = false;
    return { allowed: true, remaining: RESOURCE_LIMITS.MAX_QUERIES_PER_MINUTE - queryCount };
  }
}

export class QueryExecutor {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
  }

  private async checkRateLimit(): Promise<void> {
    const serverResult = await checkServerRateLimit();
    
    if (!serverResult.allowed) {
      throw new Error(`Rate limit exceeded. Please wait ${serverResult.retryAfter} seconds before trying again.`);
    }

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
      await this.checkRateLimit();
      
      const ast = this.parser.parse(sql);
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout (${RESOURCE_LIMITS.QUERY_TIMEOUT_MS / 1000}s limit)`)), RESOURCE_LIMITS.QUERY_TIMEOUT_MS)
      );
      
      const result = await Promise.race([
        this.executeNode(ast),
        timeoutPromise
      ]);
      
      result.executionTime = Math.round(performance.now() - startTime);
      
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
    const { userId, sessionId } = getUserContext();
    
    const { count: tableCount } = await supabase
      .from('rdbms_tables')
      .select('*', { count: 'exact', head: true });

    if (tableCount !== null && tableCount >= RESOURCE_LIMITS.MAX_TABLES) {
      throw new Error(`Maximum table limit reached (${RESOURCE_LIMITS.MAX_TABLES} tables). Drop unused tables first.`);
    }

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

    const hasPrimaryKey = node.columns.some(c => c.primaryKey);
    if (!hasPrimaryKey) {
      node.columns.unshift({
        name: 'id',
        type: 'INTEGER',
        primaryKey: true,
        autoIncrement: true,
        notNull: true,
      });
    }

    const { error } = await supabase.from('rdbms_tables').insert({
      table_name: node.tableName,
      columns: node.columns as unknown as Json,
      indexes: [] as unknown as Json,
      session_id: sessionId,
      user_id: userId || undefined,
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

    const { error } = await supabase
      .from('rdbms_tables')
      .delete()
      .eq('id', table.id);

    if (error) throw new Error(error.message);

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

    const { count: rowCount } = await supabase
      .from('rdbms_rows')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', table.id);

    const rowsToInsert = node.values.length;
    if (rowCount !== null && rowCount + rowsToInsert > RESOURCE_LIMITS.MAX_ROWS_PER_TABLE) {
      throw new Error(`Maximum row limit reached for this table (${RESOURCE_LIMITS.MAX_ROWS_PER_TABLE} rows). Delete some rows first.`);
    }
    
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

      if (values.length !== insertColumns.length) {
        throw new Error(`Column count doesn't match value count`);
      }

      for (let i = 0; i < insertColumns.length; i++) {
        const colName = insertColumns[i];
        const colDef = columns.find(c => c.name === colName);
        if (!colDef) {
          const availableCols = columns.map(c => c.name).join(', ');
          throw new Error(`Unknown column: '${colName}'. Available columns in ${node.tableName}: ${availableCols}. Use 'DESCRIBE ${node.tableName}' to see table structure.`);
        }
        
        const value = values[i];
        rowData[colName] = this.validateAndConvertValue(value, colDef);
      }

      if (autoIncrementCol && !(autoIncrementCol.name in rowData)) {
        rowData[autoIncrementCol.name] = autoIncrementValue++;
      }

      for (const col of columns) {
        if (col.notNull && !col.autoIncrement && !(col.name in rowData)) {
          if (col.defaultValue !== undefined) {
            rowData[col.name] = col.defaultValue;
          } else {
            throw new Error(`Column ${col.name} cannot be NULL`);
          }
        }
      }

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
    const tableColumns = table.columns as ColumnDefinition[];

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
          : [node.tableAlias || node.tableName, join.on.leftColumn];
        const [rightTable, rightCol] = join.on.rightColumn.includes('.')
          ? join.on.rightColumn.split('.')
          : [join.alias || join.tableName, join.on.rightColumn];

        for (const row of rows) {
          const rowData = row.data as Record<string, unknown>;
          const leftValue = leftTable === (node.tableAlias || node.tableName) ? rowData[leftCol] : rowData[`${leftTable}.${leftCol}`];
          
          let matched = false;
          for (const joinRow of joinRows) {
            const joinData = joinRow.data as Record<string, unknown>;
            const rightValue = rightTable === (join.alias || join.tableName) ? joinData[rightCol] : joinData[`${rightTable}.${rightCol}`];

            if (leftValue === rightValue) {
              matched = true;
              const mergedData: Record<string, unknown> = { ...rowData };
              for (const [key, value] of Object.entries(joinData)) {
                mergedData[`${join.alias || join.tableName}.${key}`] = value;
              }
              newRows.push({ ...row, data: mergedData as unknown as Json });
            }
          }

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

    // Check if we have aggregates or GROUP BY
    const hasAggregates = node.columns !== '*' && node.columns.some(c => c.aggregate);
    const hasGroupBy = node.groupBy && node.groupBy.length > 0;

    let resultRows: Record<string, unknown>[];
    let resultColumns: string[];

    if (hasAggregates || hasGroupBy) {
      // Handle aggregates with or without GROUP BY
      const grouped = this.groupRows(
        rows.map(r => r.data as Record<string, unknown>),
        node.groupBy || []
      );

      resultRows = [];
      for (const [, groupRows] of grouped) {
        const resultRow: Record<string, unknown> = {};

        // Add group by columns
        if (node.groupBy && node.groupBy.length > 0 && groupRows.length > 0) {
          for (const col of node.groupBy) {
            resultRow[col] = groupRows[0][col];
          }
        }

        // Calculate aggregates
        if (node.columns !== '*') {
          for (const col of node.columns) {
            if (col.aggregate) {
              const agg = col.aggregate;
              const values = agg.column === '*' 
                ? groupRows 
                : groupRows.map(r => r[agg.column]).filter(v => v !== null && v !== undefined);
              
              let result: unknown;
              switch (agg.function) {
                case 'COUNT':
                  if (agg.distinct && agg.column !== '*') {
                    result = new Set(values.map(v => JSON.stringify(v))).size;
                  } else {
                    result = agg.column === '*' ? groupRows.length : values.length;
                  }
                  break;
                case 'SUM':
                  result = values.reduce((sum: number, v) => sum + (Number(v) || 0), 0);
                  break;
                case 'AVG':
                  const numericValues = values.filter(v => typeof v === 'number');
                  result = numericValues.length > 0 
                    ? numericValues.reduce((sum: number, v) => sum + (v as number), 0) / numericValues.length 
                    : null;
                  break;
                case 'MIN':
                  result = values.length > 0 ? Math.min(...values.map(v => Number(v))) : null;
                  break;
                case 'MAX':
                  result = values.length > 0 ? Math.max(...values.map(v => Number(v))) : null;
                  break;
              }
              resultRow[col.alias || col.name] = result;
            } else if (!node.groupBy?.includes(col.name)) {
              // Non-aggregate, non-grouped column - take first value
              if (groupRows.length > 0) {
                resultRow[col.alias || col.name] = groupRows[0][col.name];
              }
            }
          }
        }

        resultRows.push(resultRow);
      }

      // Apply HAVING filter
      if (node.having) {
        resultRows = resultRows.filter(row => this.evaluateWhere(row, node.having!));
      }

      // Determine result columns
      if (node.columns === '*') {
        resultColumns = tableColumns.map(c => c.name);
      } else {
        resultColumns = node.columns.map(c => c.alias || c.name);
      }
    } else {
      // No aggregates - regular SELECT
      
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
      if (node.columns === '*') {
        resultColumns = tableColumns.map(c => c.name);
      } else {
        resultColumns = node.columns.map(c => {
          if (c.tableName) return `${c.tableName}.${c.name}`;
          return c.alias || c.name;
        });
      }

      resultRows = rows.map(row => {
        const data = row.data as Record<string, unknown>;
        const projected: Record<string, unknown> = {};
        
        if (node.columns === '*') {
          for (const col of resultColumns) {
            projected[col] = data[col];
          }
        } else {
          for (const col of node.columns) {
            const key = col.tableName ? `${col.tableName}.${col.name}` : col.name;
            const alias = col.alias || key;
            projected[alias] = data[key] ?? data[col.name];
          }
        }
        
        return projected;
      });

      // Apply DISTINCT
      if (node.distinct) {
        const seen = new Set<string>();
        resultRows = resultRows.filter(row => {
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }

    return {
      success: true,
      rows: resultRows,
      rowCount: resultRows.length,
      columns: resultColumns,
    };
  }

  private groupRows(rows: Record<string, unknown>[], groupBy: string[]): Map<string, Record<string, unknown>[]> {
    const groups = new Map<string, Record<string, unknown>[]>();
    
    if (groupBy.length === 0) {
      // No GROUP BY - treat all rows as one group
      groups.set('__all__', rows);
      return groups;
    }

    for (const row of rows) {
      const key = groupBy.map(col => JSON.stringify(row[col])).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    return groups;
  }

  private async executeUpdate(node: UpdateNode): Promise<QueryResult> {
    const table = await this.getTable(node.tableName);
    const columns = table.columns as ColumnDefinition[];

    let { data: rows } = await supabase
      .from('rdbms_rows')
      .select('*')
      .eq('table_id', table.id);

    if (!rows) rows = [];

    const toUpdate = node.where
      ? rows.filter(row => this.evaluateWhere(row.data as Record<string, unknown>, node.where!))
      : rows;

    let updateCount = 0;
    for (const row of toUpdate) {
      const data = { ...(row.data as Record<string, unknown>) };
      
      for (const [colName, value] of Object.entries(node.set)) {
        const colDef = columns.find(c => c.name === colName);
        if (!colDef) {
          const availableCols = columns.map(c => c.name).join(', ');
          throw new Error(`Unknown column: '${colName}'. Available columns: ${availableCols}. Use 'DESCRIBE ${node.tableName}' to see table structure.`);
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

    let { data: rows } = await supabase
      .from('rdbms_rows')
      .select('*')
      .eq('table_id', table.id);

    if (!rows) rows = [];

    const toDelete = node.where
      ? rows.filter(row => this.evaluateWhere(row.data as Record<string, unknown>, node.where!))
      : rows;

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

    if (indexes.some(idx => idx.name === node.indexName)) {
      throw new Error(`Index ${node.indexName} already exists`);
    }

    const columns = table.columns as ColumnDefinition[];
    for (const col of node.columns) {
      if (!columns.some(c => c.name === col)) {
        const availableCols = columns.map(c => c.name).join(', ');
        throw new Error(`Unknown column: '${col}'. Available columns in ${node.tableName}: ${availableCols}`);
      }
    }

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
    if (!data) {
      const { data: tables } = await supabase
        .from('rdbms_tables')
        .select('table_name')
        .limit(10);
      
      let helpMessage = `Table '${tableName}' does not exist.`;
      
      if (tables && tables.length > 0) {
        const tableNames = tables.map(t => t.table_name);
        const similar = tableNames.filter(t => 
          t.toLowerCase().includes(tableName.toLowerCase()) ||
          tableName.toLowerCase().includes(t.toLowerCase())
        );
        
        if (similar.length > 0) {
          helpMessage += ` Did you mean: ${similar.join(', ')}?`;
        } else {
          helpMessage += ` Available tables: ${tableNames.join(', ')}.`;
        }
        helpMessage += ` Use 'SHOW TABLES' to list all tables.`;
      } else {
        helpMessage += ` No tables exist yet. Create one with: CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY, name TEXT)`;
      }
      
      throw new Error(helpMessage);
    }

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

    if (where.operator === 'NOT') {
      return !this.evaluateWhere(data, where.right as WhereClause);
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
      case 'NOT LIKE':
        const notPattern = String(compareValue)
          .replace(/%/g, '.*')
          .replace(/_/g, '.');
        return !new RegExp(`^${notPattern}$`, 'i').test(String(value));
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
      const { userId, sessionId } = await getUserContext();
      
      await supabase.from('rdbms_query_history').insert({
        query: sql,
        result: result as unknown as Json,
        success: result.success,
        execution_time_ms: result.executionTime,
        session_id: sessionId,
        user_id: userId || undefined,
      });
    } catch {
      // Ignore logging errors
    }
  }
}
