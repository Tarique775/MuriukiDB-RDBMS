import { useState, useEffect, useCallback } from 'react';
import { QueryExecutor } from '@/lib/rdbms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { UserPlus, Trash2, Edit2, Search, Database, RefreshCw, Sparkles, X, CheckSquare } from 'lucide-react';
import { useGameStats } from '@/hooks/useGameStats';
import { FadeContent } from '@/components/animations/FadeContent';

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
}

const SAMPLE_CONTACTS = [
  { name: 'Alice Johnson', email: 'alice@example.com', phone: '+254 712 345678' },
  { name: 'Bob Smith', email: 'bob@example.com', phone: '+254 723 456789' },
  { name: 'Carol Williams', email: 'carol@example.com', phone: '+254 734 567890' },
  { name: 'David Brown', email: 'david@example.com', phone: '+254 745 678901' },
  { name: 'Eve Davis', email: 'eve@example.com', phone: '+254 756 789012' },
];

export const ContactManager = () => {
  const [executor] = useState(() => new QueryExecutor());
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ phone: '' });
  const { addXP, incrementRowsInserted } = useGameStats();

  const initializeTable = async () => {
    try {
      await executor.execute(`
        CREATE TABLE contacts (
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT
        )
      `);
      await executor.execute('CREATE INDEX idx_contacts_email ON contacts (email)');
      setInitialized(true);
      toast.success('Contacts table initialized');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        setInitialized(true);
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
        setContacts(result.rows as unknown as Contact[]);
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

  // Search on type
  useEffect(() => {
    if (!initialized) return;
    
    const searchContacts = async () => {
      if (!searchTerm.trim()) {
        await fetchContacts();
        return;
      }
      
      try {
        const result = await executor.execute(`
          SELECT * FROM contacts 
          WHERE name LIKE '%${searchTerm}%' OR email LIKE '%${searchTerm}%' OR phone LIKE '%${searchTerm}%'
          ORDER BY id
        `);
        if (result.success && result.rows) {
          setContacts(result.rows as unknown as Contact[]);
        }
      } catch (error) {
        console.error('Search error:', error);
      }
    };

    const debounce = setTimeout(searchContacts, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, initialized]);

  const loadSampleData = async () => {
    let successCount = 0;
    for (const contact of SAMPLE_CONTACTS) {
      try {
        const result = await executor.execute(`
          INSERT INTO contacts (name, email, phone) 
          VALUES ('${contact.name}', '${contact.email}', '${contact.phone}')
        `);
        if (result.success) successCount++;
      } catch (error) {
        // Skip duplicates
      }
    }
    if (successCount > 0) {
      toast.success(`Added ${successCount} sample contacts! +${successCount * 10} XP`);
      addXP(successCount * 10, 'sample_data');
      incrementRowsInserted(successCount);
    } else {
      toast.info('Sample data already loaded');
    }
    await fetchContacts();
  };

  const removeSampleData = async () => {
    try {
      for (const contact of SAMPLE_CONTACTS) {
        await executor.execute(`DELETE FROM contacts WHERE email = '${contact.email}'`);
      }
      toast.success('Sample data removed');
      await fetchContacts();
    } catch (error) {
      toast.error('Failed to remove sample data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (editingId !== null) {
        const result = await executor.execute(`
          UPDATE contacts 
          SET name = '${formData.name}', email = '${formData.email}', phone = '${formData.phone}'
          WHERE id = ${editingId}
        `);
        
        if (result.success) {
          // Optimistic update - update local state immediately
          setContacts(prev => prev.map(c => 
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
    }
  };

  const handleEdit = (contact: Contact) => {
    setFormData({ name: contact.name, email: contact.email || '', phone: contact.phone || '' });
    setEditingId(contact.id);
  };

  const handleDelete = async (id: number) => {
    try {
      const result = await executor.execute(`DELETE FROM contacts WHERE id = ${id}`);
      if (result.success) {
        // Optimistic update
        setContacts(prev => prev.filter(c => c.id !== id));
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          return newSet;
        });
        toast.success('Contact deleted');
      } else {
        toast.error(result.error || result.message || 'Delete failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Delete failed');
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
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select contacts to update');
      return;
    }

    try {
      for (const id of selectedIds) {
        if (batchFormData.phone) {
          await executor.execute(`UPDATE contacts SET phone = '${batchFormData.phone}' WHERE id = ${id}`);
        }
      }
      
      // Optimistic update
      if (batchFormData.phone) {
        setContacts(prev => prev.map(c => 
          selectedIds.has(c.id) ? { ...c, phone: batchFormData.phone } : c
        ));
      }
      
      toast.success(`Updated ${selectedIds.size} contacts`);
      setSelectedIds(new Set());
      setBatchEditMode(false);
      setBatchFormData({ phone: '' });
    } catch (error: any) {
      toast.error(error.message || 'Batch update failed');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('Select contacts to delete');
      return;
    }

    try {
      for (const id of selectedIds) {
        await executor.execute(`DELETE FROM contacts WHERE id = ${id}`);
      }
      
      // Optimistic update
      setContacts(prev => prev.filter(c => !selectedIds.has(c.id)));
      toast.success(`Deleted ${selectedIds.size} contacts`);
      setSelectedIds(new Set());
    } catch (error: any) {
      toast.error(error.message || 'Batch delete failed');
    }
  };

  const clearSearch = () => setSearchTerm('');

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
            <Button onClick={loadSampleData} variant="outline" className="font-mono text-sm gap-2 glass-button">
              <Sparkles className="w-4 h-4" />
              Load Sample
            </Button>
            <Button onClick={removeSampleData} variant="outline" className="font-mono text-sm gap-2 text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
              Remove Sample
            </Button>
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
                <Button type="submit" className="font-mono text-sm flex-1">
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
              placeholder="Search contacts... (searches on type)"
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
              >
                <CheckSquare className="w-4 h-4" />
                Edit {selectedIds.size} selected
              </Button>
              <Button 
                onClick={handleBatchDelete} 
                variant="destructive" 
                className="font-mono text-sm gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete selected
              </Button>
            </>
          )}
          
          <Button onClick={fetchContacts} variant="ghost" size="icon" title="Refresh">
            <RefreshCw className="w-4 h-4" />
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
                <Button onClick={handleBatchUpdate} className="font-mono">
                  Apply to {selectedIds.size} contacts
                </Button>
                <Button variant="ghost" onClick={() => setBatchEditMode(false)}>
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === contacts.length && contacts.length > 0}
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
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground font-mono">
                      No contacts found. Add one above or load sample data!
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow 
                      key={contact.id} 
                      className={`border-border/30 hover:bg-primary/5 transition-colors ${selectedIds.has(contact.id) ? 'bg-primary/10' : ''}`}
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
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(contact.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
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
        </Card>
      </FadeContent>

      <p className="text-xs text-muted-foreground font-mono text-center">
        All operations use the custom SQL engine • Data persisted to Lovable Cloud
      </p>
    </div>
  );
};