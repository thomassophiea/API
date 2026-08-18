import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Wifi, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { apiService } from '../services/api';
import { useGateway } from '../contexts/GatewayContext';
import apiIcon from 'figma:asset/9b113141d05aa63f60dde131842d18390c8c9401.png';

interface LoginFormProps {
  onLoginSuccess: () => void;
  onManageGateways: () => void;
}

export function LoginForm({ onLoginSuccess, onManageGateways }: LoginFormProps) {
  const { activeGateway, testGateway } = useGateway();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'failure'>('unknown');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await apiService.login(userId, password);
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!activeGateway) return;
    setIsTestingConnection(true);
    setError('');

    try {
      const result = await testGateway(activeGateway.id, userId && password ? { username: userId, password } : undefined);
      setConnectionStatus(result.success ? 'success' : 'failure');
      if (!result.success) setError(result.message);
    } catch (err) {
      setConnectionStatus('failure');
      setError(`Connection test error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <img src={apiIcon} alt="API" className="h-12 w-12 dark:invert transition-all" />
          </div>
          <CardTitle className="text-2xl text-foreground">API ONE</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to {activeGateway ? activeGateway.name : 'your Gateway'}
          </CardDescription>
          {activeGateway && (
            <div className="text-xs text-muted-foreground font-mono">
              {activeGateway.protocol}://{activeGateway.host}:{activeGateway.port}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID / Username</Label>
              <Input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter your username or user ID"
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="whitespace-pre-line">{error}</div>
                    <div className="text-xs opacity-75">
                      - Verify your username and password are correct<br/>
                      - Ensure the Gateway is accessible<br/>
                      - Check network connectivity to {activeGateway?.host || 'the Gateway'}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !userId.trim() || !password.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleTestConnection}
                disabled={isTestingConnection || isLoading}
              >
                {isTestingConnection ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    {connectionStatus === 'success' && <CheckCircle className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />}
                    {connectionStatus === 'failure' && <AlertCircle className="mr-2 h-4 w-4 text-red-500 dark:text-red-400" />}
                    {connectionStatus === 'unknown' && <Wifi className="mr-2 h-4 w-4" />}
                    Test Connection
                  </>
                )}
              </Button>

              <Button type="button" variant="ghost" className="w-full" onClick={onManageGateways}>
                <Settings className="mr-2 h-4 w-4" />
                Manage Gateways
              </Button>
            </div>
          </form>
          <div className="mt-6 text-xs text-center text-muted-foreground space-y-2">
            <div className="pt-2 border-t border-border/50">
              <strong>Troubleshooting:</strong><br/>
              - Use your Gateway's username/password<br/>
              - Ensure the Gateway is online and accessible<br/>
              - Check firewall settings for {activeGateway?.protocol === 'http' ? 'HTTP' : 'HTTPS'} (port {activeGateway?.port ?? 443})
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
