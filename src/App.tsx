import { useState, useEffect, useCallback } from 'react';
import { LoginForm } from './components/LoginForm';
import { ApiTestTool } from './components/ApiTestTool';
import { GatewayOnboarding } from './components/gateway/GatewayOnboarding';
import { GatewaySelector } from './components/gateway/GatewaySelector';
import { GatewaySettingsDialog } from './components/gateway/GatewaySettingsDialog';
import { GatewayProvider, useGateway } from './contexts/GatewayContext';
import { apiService } from './services/api';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { Activity, LogOut, User, Moon, Sun, Monitor, Loader2 } from 'lucide-react';
import apiIcon from '@/assets/app-icon.png';
import { toast } from 'sonner';

type Theme = 'light' | 'dark' | 'system';

function AppShell() {
  const { loading, activeGateway, gateways, testGateway } = useGateway();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isMounted, setIsMounted] = useState(true);
  const [gatewaySettingsOpen, setGatewaySettingsOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system';
    }
    return 'system';
  });

  // Re-check authentication whenever the active Gateway changes, since
  // tokens are scoped per Gateway ID (see src/services/api.ts).
  useEffect(() => {
    setIsAuthenticated(apiService.isAuthenticated());
    setAdminRole(apiService.getAdminRole());
  }, [activeGateway?.id]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && typeof event.reason === 'object' && event.reason.message) {
        const errorMessage = event.reason.message;

        if (errorMessage.includes('Session expired') || errorMessage.includes('Authentication required')) {
          setIsAuthenticated(false);
          setAdminRole(null);
          toast.error('Session expired', { description: 'Please login again to continue.' });
          event.preventDefault();
          return;
        }

        if (errorMessage.includes('Failed to fetch')) {
          toast.error('Network Error', { description: 'Connection to server lost. Please check your network connection.' });
          return;
        }
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      setIsMounted(false);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const applyTheme = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    return undefined;
  }, [theme, applyTheme]);

  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
    setAdminRole(apiService.getAdminRole());
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Logout timed out')), 5000));
      await Promise.race([apiService.logout(), timeoutPromise]);
    } catch (error) {
      console.warn('Logout error:', error);
    } finally {
      if (isMounted) {
        setIsAuthenticated(false);
        setAdminRole(null);
      }
    }
  }, [isMounted]);

  const handleQuickTest = useCallback(async () => {
    if (!isMounted || !activeGateway) return;
    setIsTestingConnection(true);
    try {
      const result = await testGateway(activeGateway.id);
      if (!isMounted) return;
      if (result.success) {
        toast.success('Connection test successful!', { description: `${result.message} (${result.latencyMs ?? '?'}ms)` });
      } else {
        toast.error('Connection test failed', { description: result.message });
      }
    } catch (error) {
      if (!isMounted) return;
      toast.error('Connection test failed', { description: error instanceof Error ? error.message : 'Unknown error occurred' });
    } finally {
      if (isMounted) setIsTestingConnection(false);
    }
  }, [isMounted, activeGateway, testGateway]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (gateways.length === 0) {
    return <GatewayOnboarding />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <LoginForm onLoginSuccess={handleLoginSuccess} onManageGateways={() => setGatewaySettingsOpen(true)} />
        </div>
        <GatewaySettingsDialog open={gatewaySettingsOpen} onOpenChange={setGatewaySettingsOpen} />
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <img src={apiIcon} alt="API" className="h-[30px] w-[30px] dark:invert transition-all" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">API ONE</h1>
              <p className="text-sm text-muted-foreground">
                Test, explore, and debug API endpoints via secure encrypted communication
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <GatewaySelector onManageGateways={() => setGatewaySettingsOpen(true)} />

            <Button variant="outline" size="sm" onClick={handleQuickTest} disabled={isTestingConnection} className="flex items-center space-x-2">
              <Activity className={`h-4 w-4 ${isTestingConnection ? 'animate-pulse' : ''}`} />
              <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  {theme === 'light' && <Sun className="h-4 w-4" />}
                  {theme === 'dark' && <Moon className="h-4 w-4" />}
                  {theme === 'system' && <Monitor className="h-4 w-4" />}
                  <span className="text-xs capitalize">{theme}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')} className="flex items-center space-x-2">
                  <Sun className="h-4 w-4" /><span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} className="flex items-center space-x-2">
                  <Moon className="h-4 w-4" /><span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')} className="flex items-center space-x-2">
                  <Monitor className="h-4 w-4" /><span>System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4" />
              <span className="text-muted-foreground">{adminRole ? `Admin (${adminRole})` : 'User'}</span>
            </div>

            <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center space-x-2">
              <LogOut className="h-4 w-4" /><span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0">
        <ApiTestTool />
      </main>

      <GatewaySettingsDialog open={gatewaySettingsOpen} onOpenChange={setGatewaySettingsOpen} />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <GatewayProvider>
      <AppShell />
    </GatewayProvider>
  );
}
