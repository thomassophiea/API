import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useGateway } from '../../contexts/GatewayContext';
import type { GatewayProfile } from '../../services/gatewayClient';

interface GatewayFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gateway?: GatewayProfile | null;
  onSaved?: (gateway: GatewayProfile) => void;
}

/**
 * Shared Add/Edit Gateway dialog. Minimum fields per the Gateway
 * connection model: Display Name, Host/IP, Port, Protocol, Username,
 * Password - defaulting Protocol to HTTPS and Port to 443.
 */
export function GatewayFormDialog({ open, onOpenChange, gateway, onSaved }: GatewayFormDialogProps) {
  const { addGateway, editGateway, testGateway } = useGateway();
  const isEdit = Boolean(gateway);

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('443');
  const [protocol, setProtocol] = useState<'https' | 'http'>('https');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [trustSelfSigned, setTrustSelfSigned] = useState(false);
  const [remember, setRemember] = useState(true);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setName(gateway?.name ?? '');
      setHost(gateway?.host ?? '');
      setPort(String(gateway?.port ?? 443));
      setProtocol(gateway?.protocol ?? 'https');
      setUsername(gateway?.username ?? '');
      setPassword('');
      setTrustSelfSigned(gateway?.trustSelfSigned ?? false);
      setRemember(true);
      setTestResult(null);
      setError('');
    }
  }, [open, gateway]);

  const buildInput = () => ({
    name: name.trim(),
    host: host.trim(),
    port: Number(port),
    protocol,
    username: username.trim(),
    password: password || undefined,
    trustSelfSigned,
    remember,
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      let targetId = gateway?.id;
      if (!targetId) {
        // Save a draft profile first so we have a Gateway ID to test against.
        const created = await addGateway(buildInput());
        targetId = created.id;
      }
      const result = await testGateway(targetId, username && password ? { username, password, remember } : undefined);
      setTestResult({ success: result.success, message: result.message });
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (!name.trim() || !host.trim()) throw new Error('Display name and host/IP are required.');
      const saved = isEdit && gateway
        ? await editGateway(gateway.id, buildInput())
        : await addGateway(buildInput());
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Gateway');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Gateway' : 'Add Gateway'}</DialogTitle>
          <DialogDescription>
            Connect this app to an Extreme Gateway. Credentials stay local to this application.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gw-name">Display Name</Label>
            <Input id="gw-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lab Gateway" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="gw-host">Gateway Host / IP</Label>
              <Input id="gw-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="10.20.30.40 or gateway.example.local" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-port">Port</Label>
              <Input id="gw-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Some Gateway/Campus Controller deployments expose the
            Management API on a non-standard port (e.g. 5825) instead of
            443. If Test Connection fails with a generic 404, try your
            Gateway's documented Management API port.
          </p>

          <div className="flex items-center gap-3">
            <Label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={protocol === 'https'} onChange={() => { setProtocol('https'); setPort((p) => (p === '80' ? '443' : p)); }} />
              HTTPS
            </Label>
            <Label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={protocol === 'http'} onChange={() => { setProtocol('http'); setPort((p) => (p === '443' ? '80' : p)); }} />
              HTTP
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="gw-user">Username</Label>
              <Input id="gw-user" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gw-pass">Password</Label>
              <Input id="gw-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder={isEdit ? 'Leave blank to keep current' : ''} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="gw-trust" className="text-sm">Trust self-signed certificate</Label>
              <p className="text-xs text-muted-foreground">Only enable for known lab Gateways. Disables certificate verification for this Gateway only.</p>
            </div>
            <Switch id="gw-trust" checked={trustSelfSigned} onCheckedChange={setTrustSelfSigned} />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label htmlFor="gw-remember" className="text-sm">Remember credentials for this session</Label>
              <p className="text-xs text-muted-foreground">Held only in this app's process memory - never written to disk.</p>
            </div>
            <Switch id="gw-remember" checked={remember} onCheckedChange={setRemember} />
          </div>

          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{testResult.message}</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={handleTestConnection} disabled={testing || !host.trim()}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Test Connection
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Add Gateway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
