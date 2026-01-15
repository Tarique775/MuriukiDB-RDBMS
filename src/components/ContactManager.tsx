import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QueryExecutor } from '@/lib/rdbms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { UserPlus, Trash2, Edit2, Search, Database, RefreshCw, Sparkles, X, CheckSquare, ChevronLeft, ChevronRight, Loader2, Download, FileJson, FileText, Upload } from 'lucide-react';
import { useGameStats } from '@/hooks/useGameStats';
import { FadeContent } from '@/components/animations/FadeContent';
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
}

// Random name generator for fresh sample data
const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'proton.me', 'mail.com', 'icloud.com'];

const generateRandomContact = () => {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const phonePrefix = ['+254', '+1', '+44', '+91'][Math.floor(Math.random() * 4)];
  const phoneNum = Math.floor(100000000 + Math.random() * 900000000);
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  
  return {
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${uniqueId}@${domain}`,
    phone: `${phonePrefix} ${phoneNum.toString().slice(0, 3)} ${phoneNum.toString().slice(3, 6)}${phoneNum.toString().slice(6)}`,
  };
};

const ITEMS_PER_PAGE = 10;

export const ContactManager = () => {
  const [executor] = useState(() => new QueryExecutor());
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSample, setLoadingSample] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ phone: '' });
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

  const initializeTable = async () => {
    try {
      const result = await executor.execute(`
        CREATE TABLE contacts (
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT
        )
      `);
      if (result.success) {
        await executor.execute('CREATE INDEX idx_contacts_email ON contacts (email)');
        setInitialized(true);
        toast.success('Contacts table initialized');
      }
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        setInitialized(true);
        // Don't show toast for existing table - prevents double notification
      } else {
        console.error('Init error:', error);
      }
    }
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const result = await executor.execute('SELECT * FROM contacts ORDER BY id');
      if (result.success && result.rows) {
        setAllContacts(result.rows as unknown as Contact[]);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await initializeTable();
      await fetchContacts();
    };
    init();
  }, []);

  // Filter contacts based on search term (client-side for instant search)
  const filteredContacts = useMemo(() => {
    if (!searchTerm.trim()) return allContacts;
    const term = searchTerm.toLowerCase();
    return allContacts.filter(c => 
      c.name?.toLowerCase().includes(term) || 
      c.email?.toLowerCase().includes(term) || 
      c.phone?.toLowerCase().includes(term)
    );
  }, [allContacts, searchTerm]);

  // Paginated contacts
  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredContacts, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadSampleData = async () => {
    setLoadingSample(true);
    let successCount = 0;
    let failedCount = 0;
    
    // Generate more contacts to ensure some succeed even with duplicates
    for (let i = 0; i < 8; i++) {
      const contact = generateRandomContact();
      try {
        // Escape single quotes in values
        const escapedName = contact.name.replace(/'/g, "''");
        const escapedEmail = contact.email.replace(/'/g, "''");
        const escapedPhone = contact.phone.replace(/'/g, "''");
        
        const result = await executor.execute(`
          INSERT INTO contacts (name, email, phone) 
          VALUES ('${escapedName}', '${escapedEmail}', '${escapedPhone}')
        `);
        if (result.success) {
          successCount++;
          if (successCount >= 5) break; // Stop after 5 successful inserts
        } else {
          failedCount++;
        }
      } catch (error) {
        failedCount++;
        // Skip duplicates silently
      }
    }
    
    if (successCount > 0) {
      toast.success(`Added ${successCount} sample contacts! +${successCount * 10} XP`);
      addXP(successCount * 10, 'sample_data');
      incrementRowsInserted(successCount);
    } else if (failedCount > 0) {
      toast.error('Failed to add sample data. The table might need to be initialized first.');
    } else {
      toast.info('No new contacts added');
    }
    await fetchContacts();
    setLoadingSample(false);
  };

  const removeSampleData = async () => {
    setShowClearConfirm(true);
  };

  const confirmRemoveSampleData = async () => {
    setShowClearConfirm(false);
    if (allContacts.length === 0) {
      toast.info('No data to remove');
      return;
    }
    
    setRemoving(true);
    try {
      // Delete all contacts
      const result = await executor.execute('DELETE FROM contacts WHERE 1=1');
      
      if (result.success) {
        toast.success(`Removed all ${allContacts.length} contacts`);
        setAllContacts([]);
        setSelectedIds(new Set());
      } else {
        toast.error('Failed to remove data');
      }
    } catch (error) {
      toast.error('Failed to remove data');
    } finally {
      setRemoving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (editingId !== null) {
        const result = await executor.execute(`
          UPDATE contacts 
          SET name = '${formData.name}', email = '${formData.email}', phone = '${formData.phone}'
          WHERE id = ${editingId}
        `);
        
        if (result.success) {
          // Optimistic update - update local state immediately
          setAllContacts(prev => prev.map(c => 
            c.id === editingId 
              ? { ...c, name: formData.name, email: formData.email, phone: formData.phone }
              : c
          ));
          toast.success('Contact updated');
          setEditingId(null);
        } else {
          toast.error(result.error || result.message || 'Update failed');
        }
      } else {
        const result = await executor.execute(`
          INSERT INTO contacts (name, email, phone) 
          VALUES ('${formData.name}', '${formData.email}', '${formData.phone}')
        `);
        
        if (result.success) {
          toast.success('Contact added! +10 XP');
          addXP(10, 'add_contact');
          incrementRowsInserted(1);
          await fetchContacts(); // Need to fetch to get the new ID
        } else {
          toast.error(result.error || result.message || 'Insert failed');
        }
      }
      
      setFormData({ name: '', email: '', phone: '' });
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setFormData({ name: contact.name, email: contact.email || '', phone: contact.phone || '' });
    setEditingId(contact.id);
  };

  const handleDelete = async (id: number) => {
    setPendingDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      const result = await executor.execute(`DELETE FROM contacts WHERE id = ${pendingDeleteId}`);
      if (result.success) {
        // Optimistic update
        setAllContacts(prev => prev.filter(c => c.id !== pendingDeleteId));
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(pendingDeleteId);
          return newSet;
        });
        toast.success('Contact deleted');
      } else {
        toast.error(result.error || result.message || 'Delete failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Delete failed');
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedContacts.map(c => c.id)));
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select contacts to update');
      return;
    }

    setBatchUpdating(true);
    try {
      for (const id of selectedIds) {
        if (batchFormData.phone) {
          await executor.execute(`UPDATE contacts SET phone = '${batchFormData.phone}' WHERE id = ${id}`);
        }
      }
      
      // Optimistic update
      if (batchFormData.phone) {
        setAllContacts(prev => prev.map(c => 
          selectedIds.has(c.id) ? { ...c, phone: batchFormData.phone } : c
        ));
      }
      
      toast.success(`Updated ${selectedIds.size} contacts`);
      setSelectedIds(new Set());
      setBatchEditMode(false);
      setBatchFormData({ phone: '' });
    } catch (error: any) {
      toast.error(error.message || 'Batch update failed');
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select contacts to delete');
      return;
    }
    setShowBatchDeleteConfirm(true);
  };

  const confirmBatchDelete = async () => {
    setShowBatchDeleteConfirm(false);
    setBatchDeleting(true);
    try {
      for (const id of selectedIds) {
        await executor.execute(`DELETE FROM contacts WHERE id = ${id}`);
      }
      
      // Optimistic update
      setAllContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
      toast.success(`Deleted ${selectedIds.size} contacts`);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error.message || 'Batch delete failed');
    } finally {
      setBatchDeleting(false);
    }
  };

  const clearSearch = () => setSearchTerm('');

  // Export functions
  const exportAsCSV = () => {
    if (allContacts.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    const headers = ['ID', 'Name', 'Email', 'Phone'];
    const csvContent = [
      headers.join(','),
      ...allContacts.map(c => 
        [c.id, `"${c.name}"`, `"${c.email || ''}"`, `"${c.phone || ''}"`].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${allContacts.length} contacts as CSV`);
  };

  const exportAsJSON = () => {
    if (allContacts.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    const jsonContent = JSON.stringify(allContacts, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${allContacts.length} contacts as JSON`);
  };

  // Import functions
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let contacts: { name: string; email?: string; phone?: string }[] = [];

      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        contacts = Array.isArray(data) ? data : [data];
      } else if (file.name.endsWith('.csv')) {
        const lines = text.trim().split('\n');
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
        
        const nameIdx = headers.findIndex(h => h === 'name');
        const emailIdx = headers.findIndex(h => h === 'email');
        const phoneIdx = headers.findIndex(h => h === 'phone');

        if (nameIdx === -1) {
          toast.error('CSV must have a "name" column');
          return;
        }

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          if (values[nameIdx]) {
            contacts.push({
              name: values[nameIdx],
              email: emailIdx >= 0 ? values[emailIdx] : '',
              phone: phoneIdx >= 0 ? values[phoneIdx] : '',
            });
          }
        }
      } else {
        toast.error('Unsupported file format. Use CSV or JSON.');
        return;
      }

      let successCount = 0;
      for (const contact of contacts) {
        if (!contact.name) continue;
        try {
          const result = await executor.execute(`
            INSERT INTO contacts (name, email, phone) 
            VALUES ('${contact.name.replace(/'/g, "''")}', '${(contact.email || '').replace(/'/g, "''")}', '${(contact.phone || '').replace(/'/g, "''")}')
          `);
          if (result.success) successCount++;
        } catch (error) {
          // Skip duplicates or errors
        }
      }

      if (successCount > 0) {
        toast.success(`Imported ${successCount} contacts! +${successCount * 10} XP`);
        addXP(successCount * 10, 'import_data');
        incrementRowsInserted(successCount);
        await fetchContacts();
      } else {
        toast.info('No new contacts imported (possible duplicates)');
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
    if (paginatedContacts.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedRowIndex(prev => 
          prev === null ? 0 : Math.min(prev + 1, paginatedContacts.length - 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedRowIndex(prev => 
          prev === null ? paginatedContacts.length - 1 : Math.max(prev - 1, 0)
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedRowIndex !== null && paginatedContacts[focusedRowIndex]) {
          handleEdit(paginatedContacts[focusedRowIndex]);
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (focusedRowIndex !== null && paginatedContacts[focusedRowIndex]) {
            handleDelete(paginatedContacts[focusedRowIndex].id);
          }
        }
        break;
      case ' ':
        e.preventDefault();
        if (focusedRowIndex !== null && paginatedContacts[focusedRowIndex]) {
          toggleSelect(paginatedContacts[focusedRowIndex].id);
        }
        break;
      case 'Escape':
        setFocusedRowIndex(null);
        break;
    }
  }, [paginatedContacts, focusedRowIndex]);

  return (
    <div className="space-y-6">
      <FadeContent blur duration={400}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-mono font-bold text-primary glow-text">Contact Manager Demo</h2>
            <span className="text-xs text-muted-foreground font-mono glass-card px-2 py-1 rounded">
              Powered by Custom RDBMS
            </span>
          </div>
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={loadSampleData} 
                  variant="outline" 
                  className="font-mono text-sm gap-2 glass-button"
                  disabled={loadingSample}
                >
                  {loadingSample ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {loadingSample ? 'Adding...' : 'Load Sample'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add 5 random sample contacts</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={removeSampleData} 
                  variant="outline" 
                  className="font-mono text-sm gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  disabled={removing || allContacts.length === 0}
                >
                  {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {removing ? 'Removing...' : `Clear All${allContacts.length > 0 ? ` (${allContacts.length})` : ''}`}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove all {allContacts.length} contacts from table</p>
              </TooltipContent>
            </Tooltip>
            
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="font-mono text-sm gap-2 glass-button"
                  disabled={allContacts.length === 0}
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuItem onClick={exportAsCSV} className="font-mono text-sm gap-2 cursor-pointer">
                  <FileText className="w-4 h-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsJSON} className="font-mono text-sm gap-2 cursor-pointer">
                  <FileJson className="w-4 h-4" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Import Dropdown */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".csv,.json"
              className="hidden"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="font-mono text-sm gap-2 glass-button"
                  disabled={importing}
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Importing...' : 'Import'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass-card">
                <DropdownMenuItem 
                  onClick={() => fileInputRef.current?.click()} 
                  className="font-mono text-sm gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  Import from CSV
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => fileInputRef.current?.click()} 
                  className="font-mono text-sm gap-2 cursor-pointer"
                >
                  <FileJson className="w-4 h-4" />
                  Import from JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </FadeContent>

      {/* Add/Edit Form */}
      <FadeContent blur duration={400} delay={100}>
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              {editingId !== null ? 'Edit Contact' : 'Add New Contact'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-mono text-muted-foreground">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="font-mono text-sm glass-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-mono text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="font-mono text-sm glass-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-mono text-muted-foreground">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+254 700 000000"
                  className="font-mono text-sm glass-input"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="font-mono text-sm flex-1" disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingId !== null ? 'Update' : 'Add'}
                </Button>
                {editingId !== null && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ name: '', email: '', phone: '' });
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
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search contacts... (instant search)"
              className="pl-10 pr-10 font-mono text-sm glass-input"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          {selectedIds.size > 0 && (
            <>
              <Button 
                onClick={() => setBatchEditMode(!batchEditMode)} 
                variant="outline" 
                className="font-mono text-sm gap-2"
                disabled={batchUpdating}
              >
                <CheckSquare className="w-4 h-4" />
                Edit {selectedIds.size} selected
              </Button>
              <Button 
                onClick={handleBatchDelete} 
                variant="destructive" 
                className="font-mono text-sm gap-2"
                disabled={batchDeleting}
              >
                {batchDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete selected
              </Button>
            </>
          )}
          
          <Button onClick={fetchContacts} variant="ghost" size="icon" title="Refresh" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </FadeContent>

      {/* Batch Edit Panel */}
      {batchEditMode && (
        <FadeContent blur duration={300}>
          <Card className="glass-card border-accent/30">
            <CardContent className="pt-4">
              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label className="text-xs font-mono text-muted-foreground">New Phone (for all selected)</Label>
                  <Input
                    value={batchFormData.phone}
                    onChange={(e) => setBatchFormData({ phone: e.target.value })}
                    placeholder="+254 700 000000"
                    className="font-mono text-sm glass-input"
                  />
                </div>
                <Button onClick={handleBatchUpdate} className="font-mono" disabled={batchUpdating}>
                  {batchUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Apply to {selectedIds.size} contacts
                </Button>
                <Button variant="ghost" onClick={() => setBatchEditMode(false)} disabled={batchUpdating}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeContent>
      )}

      {/* Contacts Table */}
      <FadeContent blur duration={400} delay={300}>
        <Card className="glass-card border-primary/30 overflow-hidden">
          <div 
            ref={tableRef}
            className="overflow-x-auto focus:outline-none" 
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onFocus={() => focusedRowIndex === null && paginatedContacts.length > 0 && setFocusedRowIndex(0)}
          >
            <p className="text-[10px] text-muted-foreground font-mono px-4 pt-2">
              ↑↓ Navigate • Enter Edit • Space Select • Ctrl+Del Delete
            </p>
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === paginatedContacts.length && paginatedContacts.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-mono text-xs text-primary w-16">ID</TableHead>
                  <TableHead className="font-mono text-xs text-primary">NAME</TableHead>
                  <TableHead className="font-mono text-xs text-primary">EMAIL</TableHead>
                  <TableHead className="font-mono text-xs text-primary">PHONE</TableHead>
                  <TableHead className="font-mono text-xs text-primary w-24">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground font-mono">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono">
                      {searchTerm ? 'No contacts match your search' : 'No contacts found. Add one above or load sample data!'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedContacts.map((contact, index) => (
                    <TableRow 
                      key={contact.id} 
                      className={`border-border/30 transition-colors cursor-pointer ${
                        selectedIds.has(contact.id) ? 'bg-primary/10' : ''
                      } ${focusedRowIndex === index ? 'ring-2 ring-primary ring-inset bg-primary/5' : 'hover:bg-primary/5'}`}
                      onClick={() => setFocusedRowIndex(index)}
                      onDoubleClick={() => handleEdit(contact)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={() => toggleSelect(contact.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{contact.id}</TableCell>
                      <TableCell className="font-mono text-sm">{contact.name}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{contact.email || '-'}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{contact.phone || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(contact)}
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            disabled={saving}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(contact.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            disabled={deleting}
                          >
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
          
          {/* Pagination - Always show when there are contacts */}
          {filteredContacts.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-border/30">
              <p className="text-xs font-mono text-muted-foreground">
                Showing {Math.min(((currentPage - 1) * ITEMS_PER_PAGE) + 1, filteredContacts.length)}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredContacts.length)} of {filteredContacts.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="font-mono"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono text-muted-foreground">
                  Page {currentPage} of {Math.max(1, totalPages)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="font-mono"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </FadeContent>

      <p className="text-xs text-muted-foreground font-mono text-center">
        All operations use the custom SQL engine • Data persisted to Lovable Cloud
      </p>

      {/* Confirmation Dialogs */}
      <DeleteConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear All Contacts?"
        description={`This will permanently delete all ${allContacts.length} contacts from the database.`}
        warningMessage="This action cannot be undone!"
        onConfirm={confirmRemoveSampleData}
        confirmText="Clear All"
      />

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={(open) => {
          setShowDeleteConfirm(open);
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete Contact?"
        description="This will permanently delete this contact from the database."
        onConfirm={confirmDelete}
        confirmText="Delete"
      />

      <DeleteConfirmDialog
        open={showBatchDeleteConfirm}
        onOpenChange={setShowBatchDeleteConfirm}
        title={`Delete ${selectedIds.size} Contacts?`}
        description={`This will permanently delete ${selectedIds.size} selected contacts from the database.`}
        warningMessage="This action cannot be undone!"
        onConfirm={confirmBatchDelete}
        confirmText="Delete All Selected"
      />
    </div>
  );
};