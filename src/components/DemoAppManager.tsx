import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QueryExecutor } from '@/lib/rdbms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  UserPlus, Trash2, Edit2, Search, Database, RefreshCw, Sparkles, X, 
  CheckSquare, ChevronLeft, ChevronRight, Loader2, Download, FileJson, 
  FileText, Upload, Users, User, Package, ShoppingCart, Briefcase, Radio
} from 'lucide-react';
import { useGameStats } from '@/hooks/useGameStats';
import { FadeContent } from '@/components/animations/FadeContent';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import { DynamicFormField } from '@/components/DynamicFormField';
import { DEMO_TABLES, DemoTableConfig, validateField, generateCreateTableSQL } from '@/lib/demoTables';
import { useRealtimeTable, RealtimeStatus } from '@/hooks/useRealtimeTable';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

// Icon map for table types
const TABLE_ICONS: Record<string, React.ReactNode> = {
  Users: <Users className="w-4 h-4" />,
  User: <User className="w-4 h-4" />,
  Package: <Package className="w-4 h-4" />,
  ShoppingCart: <ShoppingCart className="w-4 h-4" />,
  Briefcase: <Briefcase className="w-4 h-4" />,
};

interface DemoAppManagerProps {
  activeTableId?: string;
  onTableChange?: (tableId: string) => void;
}

export const DemoAppManager = ({ activeTableId = 'contacts', onTableChange }: DemoAppManagerProps) => {
  const [executor] = useState(() => new QueryExecutor());
  const [currentTableId, setCurrentTableId] = useState(activeTableId);
  const [allRecords, setAllRecords] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSample, setLoadingSample] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string | null>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialized, setInitialized] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [batchFormData, setBatchFormData] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const { addXP, incrementRowsInserted } = useGameStats();

  // Current table config
  const tableConfig = useMemo(() => 
    DEMO_TABLES.find(t => t.id === currentTableId) || DEMO_TABLES[0],
    [currentTableId]
  );

  // Get current table's ID from database for realtime filtering
  const [currentDbTableId, setCurrentDbTableId] = useState<string | null>(null);

  // Ref for stable callback (will be set after fetchRecords is defined)
  const fetchRecordsRef = useRef<() => void>(() => {});

  // Initialize form data with empty strings for all columns
  const getEmptyFormData = useCallback((config: DemoTableConfig) => {
    const data: Record<string, string> = {};
    config.columns.forEach(col => {
      data[col.name] = '';
    });
    return data;
  }, []);

  // Initialize table
  const initializeTable = useCallback(async (config: DemoTableConfig) => {
    if (initialized.has(config.id)) return;
    
    try {
      const sql = generateCreateTableSQL(config);
      const result = await executor.execute(sql);
      if (result.success) {
        setInitialized(prev => new Set(prev).add(config.id));
        toast.success(`${config.name} table initialized`);
      }
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        setInitialized(prev => new Set(prev).add(config.id));
      }
    }
  }, [executor, initialized]);

  // Fetch records
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await executor.execute(`SELECT * FROM ${tableConfig.tableName} ORDER BY id`);
      if (result.success && result.rows) {
        setAllRecords(result.rows as Record<string, any>[]);
      }
    } catch {
      setAllRecords([]);
    } finally {
      setLoading(false);
    }
  }, [executor, tableConfig.tableName]);

  // Update ref after fetchRecords is defined
  useEffect(() => {
    fetchRecordsRef.current = fetchRecords;
  }, [fetchRecords]);

  // Real-time updates - use stable callback via ref
  const { isConnected: realtimeConnected, lastUpdate } = useRealtimeTable({
    tableName: tableConfig.tableName,
    tableId: currentDbTableId,
    onUpdate: useCallback(() => fetchRecordsRef.current(), []),
    enabled: true,
  });

  // Initialize and fetch on table change
  useEffect(() => {
    // Immediately clear state to prevent showing previous table's data
    setAllRecords([]);
    setLoading(true);
    setFormData(getEmptyFormData(tableConfig));
    setFormErrors({});
    setEditingId(null);
    setSelectedIds(new Set());
    setSearchTerm('');
    setCurrentPage(1);
    // Reset batch edit state when switching tables
    setBatchEditMode(false);
    setBatchFormData({});
    
    const init = async () => {
      await initializeTable(tableConfig);
      await fetchRecords();
    };
    init();
  }, [tableConfig, initializeTable, fetchRecords, getEmptyFormData]);

  // Handle table switch
  const handleTableChange = (tableId: string) => {
    // Immediately clear to prevent flash of old data
    setAllRecords([]);
    setLoading(true);
    setCurrentTableId(tableId);
    onTableChange?.(tableId);
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return allRecords;
    const term = searchTerm.toLowerCase();
    return allRecords.filter(record =>
      Object.values(record).some(val =>
        val?.toString().toLowerCase().includes(term)
      )
    );
  }, [allRecords, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Reset page on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Validate form
  const validateForm = useCallback(() => {
    const errors: Record<string, string | null> = {};
    let hasErrors = false;
    
    tableConfig.columns.forEach(col => {
      const error = validateField(col, formData[col.name]);
      errors[col.name] = error;
      if (error) hasErrors = true;
    });
    
    setFormErrors(errors);
    return !hasErrors;
  }, [tableConfig.columns, formData]);

  // Load sample data using batch INSERT for efficiency
  const loadSampleData = async () => {
    // Capture current config to prevent issues if user switches tables
    const config = tableConfig;
    setLoadingSample(true);
    
    try {
      // Generate all sample rows first
      const sampleRows: Record<string, any>[] = [];
      for (let i = 0; i < 5; i++) {
        sampleRows.push(config.sampleDataGenerator());
      }
      
      if (sampleRows.length === 0) {
        setLoadingSample(false);
        return;
      }
      
      // Build a single batch INSERT statement
      const columns = Object.keys(sampleRows[0]).join(', ');
      const valuesClauses = sampleRows.map(row => {
        const values = Object.values(row).map(v => 
          typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
        ).join(', ');
        return `(${values})`;
      }).join(', ');
      
      const batchSQL = `INSERT INTO ${config.tableName} (${columns}) VALUES ${valuesClauses}`;
      const result = await executor.execute(batchSQL);
      
      if (result.success) {
        const count = sampleRows.length;
        toast.success(`Added ${count} sample ${config.name.toLowerCase()}! +${count * 10} XP`);
        addXP(count * 10, 'sample_data');
        incrementRowsInserted(count);
      } else {
        // Fallback: try inserting one by one if batch fails
        let successCount = 0;
        for (const row of sampleRows) {
          const cols = Object.keys(row).join(', ');
          const vals = Object.values(row).map(v => 
            typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
          ).join(', ');
          
          const singleResult = await executor.execute(
            `INSERT INTO ${config.tableName} (${cols}) VALUES (${vals})`
          );
          if (singleResult.success) successCount++;
        }
        
        if (successCount > 0) {
          toast.success(`Added ${successCount} sample ${config.name.toLowerCase()}! +${successCount * 10} XP`);
          addXP(successCount * 10, 'sample_data');
          incrementRowsInserted(successCount);
        }
      }
    } catch {
      toast.error('Failed to load sample data');
    }
    
    await fetchRecords();
    setLoadingSample(false);
  };

  // Clear all data
  const confirmClearData = async () => {
    setShowClearConfirm(false);
    setRemoving(true);
    try {
      const result = await executor.execute(`DELETE FROM ${tableConfig.tableName} WHERE 1=1`);
      if (result.success) {
        toast.success(`Removed all ${allRecords.length} ${tableConfig.name.toLowerCase()}`);
        setAllRecords([]);
        setSelectedIds(new Set());
      }
    } catch (error) {
      toast.error('Failed to remove data');
    } finally {
      setRemoving(false);
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSaving(true);
    try {
      if (editingId !== null) {
        // Update
        const setParts = tableConfig.columns.map(col => {
          const value = formData[col.name];
          if (value === '' || value === undefined) return `${col.name} = NULL`;
          return col.type === 'number' || col.type === 'currency'
            ? `${col.name} = ${value}`
            : `${col.name} = '${value.replace(/'/g, "''")}'`;
        }).join(', ');
        
        const result = await executor.execute(
          `UPDATE ${tableConfig.tableName} SET ${setParts} WHERE id = ${editingId}`
        );
        
        if (result.success) {
          setAllRecords(prev => prev.map(r =>
            r.id === editingId ? { ...r, ...formData } : r
          ));
          toast.success(`${tableConfig.name.slice(0, -1)} updated`);
          setEditingId(null);
        } else {
          toast.error(result.error || result.message || 'Update failed');
        }
      } else {
        // Insert
        const nonEmptyData: Record<string, string> = {};
        tableConfig.columns.forEach(col => {
          if (formData[col.name]) nonEmptyData[col.name] = formData[col.name];
        });
        
        const columns = Object.keys(nonEmptyData).join(', ');
        const values = Object.values(nonEmptyData).map((v, i) => {
          const col = tableConfig.columns.find(c => c.name === Object.keys(nonEmptyData)[i]);
          return (col?.type === 'number' || col?.type === 'currency') ? v : `'${v.replace(/'/g, "''")}'`;
        }).join(', ');
        
        const result = await executor.execute(
          `INSERT INTO ${tableConfig.tableName} (${columns}) VALUES (${values})`
        );
        
        if (result.success) {
          toast.success(`${tableConfig.name.slice(0, -1)} added! +10 XP`);
          addXP(10, 'add_record');
          incrementRowsInserted(1);
          await fetchRecords();
        } else {
          toast.error(result.error || result.message || 'Insert failed');
        }
      }
      
      setFormData(getEmptyFormData(tableConfig));
      setFormErrors({});
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  // Edit record
  const handleEdit = (record: Record<string, any>) => {
    const data: Record<string, string> = {};
    tableConfig.columns.forEach(col => {
      data[col.name] = record[col.name]?.toString() || '';
    });
    setFormData(data);
    setEditingId(record.id);
    setFormErrors({});
  };

  // Delete record
  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const result = await executor.execute(`DELETE FROM ${tableConfig.tableName} WHERE id = ${pendingDeleteId}`);
      if (result.success) {
        setAllRecords(prev => prev.filter(r => r.id !== pendingDeleteId));
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(pendingDeleteId);
          return newSet;
        });
        toast.success(`${tableConfig.name.slice(0, -1)} deleted`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Delete failed');
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  // Batch delete
  const confirmBatchDelete = async () => {
    setShowBatchDeleteConfirm(false);
    setBatchDeleting(true);
    try {
      for (const id of selectedIds) {
        await executor.execute(`DELETE FROM ${tableConfig.tableName} WHERE id = ${id}`);
      }
      setAllRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
      toast.success(`Deleted ${selectedIds.size} ${tableConfig.name.toLowerCase()}`);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error.message || 'Batch delete failed');
    } finally {
      setBatchDeleting(false);
    }
  };

  // Batch update
  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select records to update');
      return;
    }
    
    // Check if any fields have values to update
    const fieldsToUpdate = Object.entries(batchFormData).filter(([_, v]) => v.trim() !== '');
    if (fieldsToUpdate.length === 0) {
      toast.error('Enter at least one field to update');
      return;
    }

    setBatchUpdating(true);
    try {
      // Build SET clause from non-empty batch form fields
      const setParts = fieldsToUpdate.map(([key, value]) => {
        const col = tableConfig.columns.find(c => c.name === key);
        if (col?.type === 'number' || col?.type === 'currency') {
          return `${key} = ${value}`;
        }
        return `${key} = '${value.replace(/'/g, "''")}'`;
      }).join(', ');
      
      // Update each selected record
      for (const id of selectedIds) {
        await executor.execute(`UPDATE ${tableConfig.tableName} SET ${setParts} WHERE id = ${id}`);
      }
      
      // Optimistic UI update
      setAllRecords(prev => prev.map(r => {
        if (selectedIds.has(r.id)) {
          const updates: Record<string, any> = {};
          fieldsToUpdate.forEach(([key, value]) => {
            const col = tableConfig.columns.find(c => c.name === key);
            updates[key] = col?.type === 'number' || col?.type === 'currency' ? parseFloat(value) : value;
          });
          return { ...r, ...updates };
        }
        return r;
      }));
      
      toast.success(`Updated ${selectedIds.size} ${tableConfig.name.toLowerCase()}`);
      setSelectedIds(new Set());
      setBatchEditMode(false);
      setBatchFormData({});
    } catch (error: any) {
      toast.error(error.message || 'Batch update failed');
    } finally {
      setBatchUpdating(false);
    }
  };

  // Selection
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRecords.map(r => r.id)));
    }
  };

  // Export
  const exportAsCSV = () => {
    if (allRecords.length === 0) {
      toast.error('No data to export');
      return;
    }
    const headers = ['ID', ...tableConfig.columns.map(c => c.name.toUpperCase())];
    const csvContent = [
      headers.join(','),
      ...allRecords.map(r =>
        [r.id, ...tableConfig.columns.map(c => `"${r[c.name] || ''}"`)].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableConfig.tableName}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${allRecords.length} ${tableConfig.name.toLowerCase()} as CSV`);
  };

  const exportAsJSON = () => {
    if (allRecords.length === 0) {
      toast.error('No data to export');
      return;
    }
    const blob = new Blob([JSON.stringify(allRecords, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableConfig.tableName}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${allRecords.length} ${tableConfig.name.toLowerCase()} as JSON`);
  };

  // Import
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let records: Record<string, any>[] = [];

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        records = Array.isArray(data) ? data : [data];
      } else if (file.name.endsWith('.csv')) {
        const lines = text.trim().split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const record: Record<string, any> = {};
          headers.forEach((h, idx) => {
            if (tableConfig.columns.some(c => c.name === h)) {
              record[h] = values[idx];
            }
          });
          if (Object.keys(record).length > 0) records.push(record);
        }
      }

      let successCount = 0;
      for (const record of records) {
        const columns = Object.keys(record).filter(k => 
          tableConfig.columns.some(c => c.name === k)
        );
        if (columns.length === 0) continue;
        
        try {
          const values = columns.map(k => {
            const col = tableConfig.columns.find(c => c.name === k);
            const v = record[k];
            return (col?.type === 'number' || col?.type === 'currency') 
              ? v : `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          
          const result = await executor.execute(
            `INSERT INTO ${tableConfig.tableName} (${columns.join(', ')}) VALUES (${values})`
          );
          if (result.success) successCount++;
        } catch (error) {
          // Skip errors
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} ${tableConfig.name.toLowerCase()}! +${successCount * 10} XP`);
        addXP(successCount * 10, 'import_data');
        incrementRowsInserted(successCount);
        await fetchRecords();
      } else {
        toast.info('No new records imported');
      }
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (paginatedRecords.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedRowIndex(prev =>
          prev === null ? 0 : Math.min(prev + 1, paginatedRecords.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedRowIndex(prev =>
          prev === null ? paginatedRecords.length - 1 : Math.max(prev - 1, 0)
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedRowIndex !== null && paginatedRecords[focusedRowIndex]) {
          handleEdit(paginatedRecords[focusedRowIndex]);
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (focusedRowIndex !== null && paginatedRecords[focusedRowIndex]) {
            setPendingDeleteId(paginatedRecords[focusedRowIndex].id);
            setShowDeleteConfirm(true);
          }
        }
        break;
      case ' ':
        e.preventDefault();
        if (focusedRowIndex !== null && paginatedRecords[focusedRowIndex]) {
          toggleSelect(paginatedRecords[focusedRowIndex].id);
        }
        break;
      case 'Escape':
        setFocusedRowIndex(null);
        break;
    }
  }, [paginatedRecords, focusedRowIndex]);

  return (
    <div className="space-y-4 md:space-y-6">
      <FadeContent blur duration={400}>
        {/* Table Tabs */}
        <div data-tour="table-selector" className="flex gap-1 mb-4 overflow-x-auto scrollbar-thin pb-2">
          {DEMO_TABLES.map(table => (
            <Button
              key={table.id}
              variant={currentTableId === table.id ? "default" : "outline"}
              size="sm"
              onClick={() => handleTableChange(table.id)}
              className={cn(
                "font-mono text-xs gap-1.5 flex-shrink-0 whitespace-nowrap",
                currentTableId === table.id ? "" : "glass-button"
              )}
            >
              {TABLE_ICONS[table.icon]}
              <span className="hidden sm:inline">{table.name}</span>
            </Button>
          ))}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Database className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-mono font-bold text-primary glow-text truncate">
                {tableConfig.name} Manager
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {tableConfig.description}
                </span>
                <RealtimeStatus isConnected={realtimeConnected} lastUpdate={lastUpdate} />
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-tour="load-sample"
                  onClick={loadSampleData}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs gap-1.5 glass-button"
                  disabled={loadingSample}
                >
                  {loadingSample ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{loadingSample ? 'Adding...' : 'Load Sample'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Add 5 random sample records</p></TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setShowClearConfirm(true)}
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                  disabled={removing || allRecords.length === 0}
                >
                  {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{removing ? 'Removing...' : `Clear (${allRecords.length})`}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Remove all {tableConfig.name.toLowerCase()}</p></TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 glass-button" disabled={allRecords.length === 0}>
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuItem onClick={exportAsCSV} className="font-mono text-xs gap-2 cursor-pointer">
                  <FileText className="w-3.5 h-3.5" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsJSON} className="font-mono text-xs gap-2 cursor-pointer">
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".csv,.json" className="hidden" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 glass-button" disabled={importing}>
                  {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{importing ? 'Importing...' : 'Import'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="font-mono text-xs gap-2 cursor-pointer">
                  <FileText className="w-3.5 h-3.5" /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="font-mono text-xs gap-2 cursor-pointer">
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </FadeContent>

      {/* Add/Edit Form */}
      <FadeContent blur duration={400} delay={100}>
        <Card data-tour="add-form" className="glass-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              {editingId !== null ? `Edit ${tableConfig.name.slice(0, -1)}` : `Add New ${tableConfig.name.slice(0, -1)}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {tableConfig.columns.map(col => (
                <DynamicFormField
                  key={col.name}
                  column={col}
                  value={formData[col.name] || ''}
                  onChange={(val) => setFormData(prev => ({ ...prev, [col.name]: val }))}
                  error={formErrors[col.name]}
                  disabled={saving}
                />
              ))}
              <div className="flex items-end gap-2 col-span-1 sm:col-span-2 lg:col-span-1">
                <Button type="submit" className="font-mono text-sm flex-1" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingId !== null ? 'Update' : 'Add'}
                </Button>
                {editingId !== null && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setFormData(getEmptyFormData(tableConfig));
                      setFormErrors({});
                    }}
                    className="font-mono text-sm"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </FadeContent>

      {/* Search & Batch Actions */}
      <FadeContent blur duration={400} delay={200}>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="pl-10 pr-10 font-mono text-sm glass-input w-full"
            />
            {searchTerm && (
              <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {selectedIds.size > 0 && (
            <>
              <Button onClick={() => setBatchEditMode(!batchEditMode)} variant="outline" className="font-mono text-xs gap-1.5" disabled={batchUpdating}>
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span> {selectedIds.size}
              </Button>
              <Button onClick={() => setShowBatchDeleteConfirm(true)} variant="destructive" className="font-mono text-xs gap-1.5" disabled={batchDeleting}>
                {batchDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          )}
          
          <Button onClick={fetchRecords} variant="ghost" size="icon" title="Refresh" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </FadeContent>

      {/* Batch Edit Panel */}
      {batchEditMode && (
        <FadeContent blur duration={300}>
          <Card className="glass-card border-accent/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                Batch Edit {selectedIds.size} {tableConfig.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Only filled fields will be updated. Leave fields empty to keep their current values.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {tableConfig.columns.map(col => (
                  <DynamicFormField
                    key={col.name}
                    column={{ ...col, required: false }}
                    value={batchFormData[col.name] || ''}
                    onChange={(val) => setBatchFormData(prev => ({ ...prev, [col.name]: val }))}
                    error={null}
                    disabled={batchUpdating}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleBatchUpdate} className="font-mono" disabled={batchUpdating}>
                  {batchUpdating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Apply to {selectedIds.size} {tableConfig.name.toLowerCase()}
                </Button>
                <Button variant="ghost" onClick={() => { setBatchEditMode(false); setBatchFormData({}); }} disabled={batchUpdating}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeContent>
      )}

      {/* Data Table */}
      <FadeContent blur duration={400} delay={300}>
        <Card data-tour="data-table" className="glass-card border-primary/30 overflow-hidden">
          <div
            ref={tableRef}
            className="overflow-x-auto scrollbar-thin focus:outline-none"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => focusedRowIndex === null && paginatedRecords.length > 0 && setFocusedRowIndex(0)}
          >
            <p className="text-[10px] text-muted-foreground font-mono px-4 pt-2">
              ↑↓ Navigate • Enter Edit • Space Select • Ctrl+Del Delete
            </p>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-mono text-xs text-primary w-16">ID</TableHead>
                  {tableConfig.columns.map(col => (
                    <TableHead key={col.name} className="font-mono text-xs text-primary uppercase">
                      {col.name}
                    </TableHead>
                  ))}
                  <TableHead className="font-mono text-xs text-primary w-24">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={tableConfig.columns.length + 3} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground font-mono">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableConfig.columns.length + 3} className="text-center py-8 text-muted-foreground font-mono">
                      {searchTerm ? 'No records match your search' : 'No records found. Add one above or load sample data!'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((record, index) => (
                    <TableRow
                      key={record.id}
                      className={cn(
                        "border-border/30 transition-colors cursor-pointer",
                        selectedIds.has(record.id) && "bg-primary/10",
                        focusedRowIndex === index ? "ring-2 ring-primary ring-inset bg-primary/5" : "hover:bg-primary/5"
                      )}
                      onClick={() => setFocusedRowIndex(index)}
                      onDoubleClick={() => handleEdit(record)}
                    >
                      <TableCell>
                        <Checkbox checked={selectedIds.has(record.id)} onCheckedChange={() => toggleSelect(record.id)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{record.id}</TableCell>
                      {tableConfig.columns.map(col => (
                        <TableCell key={col.name} className="font-mono text-sm">
                          {record[col.name] ?? <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} className="h-7 w-7 text-muted-foreground hover:text-primary" disabled={saving}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setPendingDeleteId(record.id); setShowDeleteConfirm(true); }} className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={deleting}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredRecords.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-border/30">
              <p className="text-xs font-mono text-muted-foreground">
                {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredRecords.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-mono">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono text-muted-foreground">Page {currentPage} of {Math.max(1, totalPages)}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="font-mono">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </FadeContent>

      <p className="text-xs text-muted-foreground font-mono text-center">
        All operations use the custom SQL engine • Data persisted to Supabase
      </p>

      {/* Confirmation Dialogs */}
      <DeleteConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title={`Clear All ${tableConfig.name}?`}
        description={`This will permanently delete all ${allRecords.length} ${tableConfig.name.toLowerCase()} from the database.`}
        warningMessage="This action cannot be undone!"
        onConfirm={confirmClearData}
        confirmText="Clear All"
      />

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => { setShowDeleteConfirm(open); if (!open) setPendingDeleteId(null); }}
        title={`Delete ${tableConfig.name.slice(0, -1)}?`}
        description={`This will permanently delete this ${tableConfig.name.slice(0, -1).toLowerCase()} from the database.`}
        onConfirm={confirmDelete}
        confirmText="Delete"
      />

      <DeleteConfirmDialog
        open={showBatchDeleteConfirm}
        onOpenChange={setShowBatchDeleteConfirm}
        title={`Delete ${selectedIds.size} ${tableConfig.name}?`}
        description={`This will permanently delete ${selectedIds.size} selected ${tableConfig.name.toLowerCase()} from the database.`}
        warningMessage="This action cannot be undone!"
        onConfirm={confirmBatchDelete}
        confirmText="Delete All Selected"
      />
    </div>
  );
};
