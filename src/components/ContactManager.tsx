import { useState, useEffect } from 'react';
import { QueryExecutor } from '@/lib/rdbms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { UserPlus, Trash2, Edit2, Search, Database, RefreshCw, Sparkles } from 'lucide-react';
import { useGameStats } from '@/hooks/useGameStats';

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
  const { addXP, incrementRowsInserted } = useGameStats();

  const initializeTable = async () => {
    try {
      // Create contacts table if it doesn't exist
      await executor.execute(`
        CREATE TABLE contacts (
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT
        )
      `);
      
      // Create index on email for faster lookups
      await executor.execute('CREATE INDEX idx_contacts_email ON contacts (email)');
      
      setInitialized(true);
      toast.success('Contacts table initialized');
    } catch (error: any) {
      // Table might already exist
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      if (editingId !== null) {
        // Update existing contact
        const result = await executor.execute(`
          UPDATE contacts 
          SET name = '${formData.name}', email = '${formData.email}', phone = '${formData.phone}'
          WHERE id = ${editingId}
        `);
        
        if (result.success) {
          toast.success('Contact updated');
          setEditingId(null);
        } else {
          toast.error(result.error || result.message || 'Update failed');
        }
      } else {
        // Insert new contact
        const result = await executor.execute(`
          INSERT INTO contacts (name, email, phone) 
          VALUES ('${formData.name}', '${formData.email}', '${formData.phone}')
        `);
        
        if (result.success) {
          toast.success('Contact added! +10 XP');
          addXP(10, 'add_contact');
          incrementRowsInserted(1);
        } else {
          toast.error(result.error || result.message || 'Insert failed');
        }
      }
      
      setFormData({ name: '', email: '', phone: '' });
      await fetchContacts();
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
        toast.success('Contact deleted');
        await fetchContacts();
      } else {
        toast.error(result.error || result.message || 'Delete failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const handleSearch = async () => {
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

  const filteredContacts = contacts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-mono font-bold text-primary">Contact Manager Demo</h2>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            Powered by Custom RDBMS
          </span>
        </div>
        <Button onClick={loadSampleData} variant="outline" className="font-mono text-sm gap-2">
          <Sparkles className="w-4 h-4" />
          Load Sample Data
        </Button>
      </div>

      {/* Add/Edit Form */}
      <Card className="border-primary/30 bg-card/50 backdrop-blur">
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
                className="font-mono text-sm bg-background/50 border-border/50 focus:border-primary"
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
                className="font-mono text-sm bg-background/50 border-border/50 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs font-mono text-muted-foreground">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+254 700 000000"
                className="font-mono text-sm bg-background/50 border-border/50 focus:border-primary"
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

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search contacts..."
            className="pl-10 font-mono text-sm bg-background/50 border-border/50 focus:border-primary"
          />
        </div>
        <Button onClick={handleSearch} variant="outline" className="font-mono text-sm">
          Search
        </Button>
        <Button onClick={fetchContacts} variant="ghost" size="icon" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Contacts Table */}
      <Card className="border-primary/30 bg-card/50 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono">
                    No contacts found. Add one above or load sample data!
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id} className="border-border/30 hover:bg-primary/5">
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

      <p className="text-xs text-muted-foreground font-mono text-center">
        All operations use the custom SQL engine • Data persisted to Lovable Cloud
      </p>
    </div>
  );
};
