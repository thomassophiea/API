import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import { Plus, Pencil, Trash2, Wifi, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useGateway } from '../../contexts/GatewayContext';
import { GatewayFormDialog } from './GatewayFormDialog';
import type { GatewayProfile } from '../../services/gatewayClient';

/**
 * Settings > Gateways management screen:
 *   + Add Gateway
 *   Name / Address / Status / Actions (Connect, Test, Edit, Delete)
 */
export function GatewayManager() {
  const { gateways, activeGatewayId, allowCustomGateways, selectGateway, deleteGateway, testGateway } = useGateway();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GatewayProfile | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GatewayProfile | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (g: GatewayProfile) => { setEditing(g); setDialogOpen(true); };

  const handleTest = async (g: GatewayProfile) => {
    setTestingId(g.id);
    try {
      const result = await testGateway(g.id);
      if (result.success) {
        toast.success('Connected', { description: `${g.name}: ${result.message} (${result.latencyMs ?? '?'}ms)` });
      } else {
        toast.error('Connection failed', { description: result.message });
      }
    } finally {
      setTestingId(null);
    }
  };

  const handleSelect = async (g: GatewayProfile) => {
    setSelectingId(g.id);
    try {
      await selectGateway(g.id);
      toast.success(`${g.name} is now the active Gateway`);
    } finally {
      setSelectingId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteGateway(pendingDelete.id);
      toast.success(`${pendingDelete.name} removed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete Gateway');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gateways</h2>
          <p className="text-sm text-muted-foreground">Manage the Gateway connection profiles this app can use.</p>
        </div>
        {allowCustomGateways ? (
          <Button onClick={openAdd} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Gateway
          </Button>
        ) : (
          <Badge variant="outline" className="flex items-center gap-1"><Lock className="h-3 w-3" /> Hosted mode</Badge>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {gateways.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No Gateways yet.
              </TableCell>
            </TableRow>
          )}
          {gateways.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${g.id === activeGatewayId ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                {g.name}
                {g.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
              </TableCell>
              <TableCell className="font-mono text-sm">{g.protocol}://{g.host}:{g.port}</TableCell>
              <TableCell>
                {g.id === activeGatewayId ? (
                  <Badge>Active</Badge>
                ) : (
                  <Badge variant="outline">{g.hasStoredCredentials ? 'Ready' : 'Not Connected'}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => handleTest(g)} disabled={testingId === g.id}>
                  {testingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Test'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleSelect(g)} disabled={g.id === activeGatewayId || selectingId === g.id}>
                  {selectingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wifi className="h-4 w-4 mr-1" />Connect</>}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                {!g.locked && (
                  <Button size="sm" variant="ghost" onClick={() => setPendingDelete(g)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <GatewayFormDialog open={dialogOpen} onOpenChange={setDialogOpen} gateway={editing} />

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open: boolean) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the Gateway profile and any stored credentials for it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
