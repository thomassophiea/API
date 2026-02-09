import { useState, useEffect, useCallback, useMemo } from 'react';
import { LoginForm } from './components/LoginForm';
import { ApiTestTool } from './components/ApiTestTool';
import { apiService } from './services/api';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './components/ui/dropdown-menu';
import { TestTube, Activity, LogOut, User, Moon, Sun, Monitor } from 'lucide-react';
import apiIcon from 'figma:asset/9b113141d05aa63f60dde131842d18390c8c9401.png';
import { toast } from 'sonner';

type Theme = 'light' | 'dark' | 'system';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminRole, setAdminRole] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isMounted, setIsMounted] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    // Check if user is already authenticated
    if (apiService.isAuthenticated()) {
      setIsAuthenticated(true);
      setAdminRole(apiService.getAdminRole());
    }

    // Listen for session expiration errors
    const handleSessionExpired = () => {
      setIsAuthenticated(false);
      setAdminRole(null);
      toast.error('Session expired', {
        description: 'Please login again to continue.'
      });
    };

    // Add error handling for API calls throughout the app
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && 
          typeof event.reason === 'object' && 
          event.reason.message) {
        
        const errorMessage = event.reason.message;
        
        // Handle session expiration
        if (errorMessage.includes('Session expired') || 
            errorMessage.includes('Authentication required')) {
          handleSessionExpired();
          event.preventDefault(); // Prevent default error handling
          return;
        }
        
        // Handle network errors gracefully
        if (errorMessage.includes('Failed to fetch') || 
            errorMessage.includes('TypeError: Failed to fetch')) {
          console.error('Network error detected:', errorMessage);
          // Don't prevent default handling, but log for debugging
          toast.error('Network Error', {
            description: 'Connection to server lost. Please check your network connection.'
          });
          return;
        }
        
        // Handle CORS errors
        if (errorMessage.includes('CORS')) {
          console.error('CORS error detected:', errorMessage);
          toast.error('Server Configuration Error', {
            description: 'CORS policy is blocking the request. Please contact administrator.'
          });
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

  // Memoize theme application function
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

  // Theme management effect
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);

    // Listen for system theme changes when using system theme
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, applyTheme]);

  const handleLoginSuccess = useCallback(() => {
    setIsAuthenticated(true);
    setAdminRole(apiService.getAdminRole());
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // Add timeout to logout to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Logout timed out')), 5000)
      );
      
      const logoutPromise = apiService.logout();
      
      await Promise.race([logoutPromise, timeoutPromise]);
    } catch (error) {
      console.warn('Logout error:', error);
      // Continue with logout even if API call fails
    } finally {
      if (isMounted) {
        setIsAuthenticated(false);
        setAdminRole(null);
      }
    }
  }, [isMounted]);

  const handleQuickTest = useCallback(async () => {
    if (!isMounted) return;
    
    setIsTestingConnection(true);
    
    try {
      // First test basic connectivity
      console.log('Testing API connectivity...');
      const connectivityResult = await apiService.testConnectivity();
      
      if (!connectivityResult.success) {
        if (!isMounted) return;
        
        let errorMessage = connectivityResult.message;
        let description = 'Cannot reach the API server';
        
        // Provide specific guidance based on error type
        if (connectivityResult.message.includes('CORS')) {
          description = 'CORS policy is blocking the request. Check server configuration.';
        } else if (connectivityResult.message.includes('timeout')) {
          description = 'Server is not responding. Check if the server is running and network connection.';
        } else if (connectivityResult.message.includes('SSL') || connectivityResult.message.includes('certificate')) {
          description = 'SSL/Certificate error. Check HTTPS configuration.';
        } else if (connectivityResult.message.includes('network')) {
          description = 'Network error. Check internet connection and firewall settings.';
        }
        
        toast.error('Connection test failed', {
          description: description
        });
        return;
      }
      
      // If basic connectivity works, test authenticated endpoint
      console.log('Testing authenticated API call...');
      const response = await apiService.makeAuthenticatedRequest('/v1/globalsettings', {
        method: 'GET'
      });
      
      if (!isMounted) return; // Component was unmounted during request
      
      if (response.ok) {
        toast.success('Connection test successful!', {
          description: 'API server is reachable and authenticated.'
        });
      } else {
        let description = `API returned status: ${response.status} ${response.statusText}`;
        
        if (response.status === 401) {
          description = 'Authentication failed. Please try logging in again.';
        } else if (response.status === 403) {
          description = 'Access denied. Check user permissions.';
        } else if (response.status === 404) {
          description = 'API endpoint not found.';
        } else if (response.status >= 500) {
          description = 'Server error. Check server logs.';
        }
        
        toast.error('Connection test failed', {
          description: description
        });
      }
    } catch (error) {
      if (!isMounted) return; // Component was unmounted during request
      
      console.error('Connection test error:', error);
      
      let errorMessage = 'Connection test failed';
      let description = 'Unknown error occurred';
      
      if (error instanceof Error) {
        description = error.message;
        
        // Provide specific guidance based on error type
        if (error.message.includes('Failed to fetch')) {
          description = 'Cannot connect to server. Check:\n• Server is running\n• Network connection\n• Firewall settings\n• CORS configuration';
        } else if (error.message.includes('timeout')) {
          description = 'Request timed out. Server may be overloaded or unreachable.';
        } else if (error.message.includes('CORS')) {
          description = 'CORS policy blocking request. Server needs to allow cross-origin requests.';
        } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
          description = 'SSL/Certificate error. Check HTTPS configuration.';
        } else if (error.message.includes('network')) {
          description = 'Network error. Check internet connection.';
        }
      }
      
      toast.error(errorMessage, {
        description: description
      });
    } finally {
      if (isMounted) {
        setIsTestingConnection(false);
      }
    }
  }, [isMounted]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          <LoginForm onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <img src={apiIcon} alt="API" className="h-[30px] w-[30px] dark:invert transition-all" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">API Test Tool</h1>
              <p className="text-sm text-muted-foreground">
                Test, explore, and debug API endpoints via secure encrypted communication
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Connection Status */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400"></div>
              <span>Connected to NGINX Server</span>
            </div>

            {/* Quick Connection Test */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickTest}
              disabled={isTestingConnection}
              className="flex items-center space-x-2"
            >
              <Activity className={`h-4 w-4 ${isTestingConnection ? 'animate-pulse' : ''}`} />
              <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
            </Button>

            {/* Theme Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  {theme === 'light' && <Sun className="h-4 w-4" />}
                  {theme === 'dark' && <Moon className="h-4 w-4" />}
                  {theme === 'system' && <Monitor className="h-4 w-4" />}
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')} className="flex items-center space-x-2">
                  <Sun className="h-4 w-4" />
                  <span>Light</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} className="flex items-center space-x-2">
                  <Moon className="h-4 w-4" />
                  <span>Dark</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')} className="flex items-center space-x-2">
                  <Monitor className="h-4 w-4" />
                  <span>System</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4" />
              <span className="text-muted-foreground">
                {adminRole ? `Admin (${adminRole})` : 'User'}
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 min-h-0">
        <ApiTestTool />
      </main>
      
      <Toaster />
    </div>
  );
}