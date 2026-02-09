// Use proxy in production, direct connection in development
const isProduction = import.meta.env.PROD || window.location.hostname !== 'localhost';
const devBaseUrl = import.meta.env.VITE_DEV_CAMPUS_CONTROLLER_URL || 'https://localhost:443';
const BASE_URL = isProduction
  ? '/api/management'
  : `${devBaseUrl}/management`;

console.log('[API Service] Environment:', isProduction ? 'Production (using proxy)' : 'Development (direct)');
console.log('[API Service] BASE_URL:', BASE_URL);

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  idle_timeout: number;
  refresh_token: string;
  adminRole: string;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  async login(userId: string, password: string): Promise<AuthResponse> {
    if (!userId.trim()) throw new Error('User ID is required');
    if (!password.trim()) throw new Error('Password is required');

    const requestBody = {
      grant_type: 'password',
      username: userId.trim(),
      password: password,
      scope: ''
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const authResponse: AuthResponse = await response.json();
        this.accessToken = authResponse.access_token;
        this.refreshToken = authResponse.refresh_token;
        localStorage.setItem('access_token', authResponse.access_token);
        localStorage.setItem('refresh_token', authResponse.refresh_token);
        localStorage.setItem('admin_role', authResponse.adminRole);
        return authResponse;
      } else {
        const errorText = await response.text();
        let errorMessage = 'Authentication failed';

        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.length > 0) {
            errorMessage = errorData.errors[0].errorMessage || errorMessage;
          }
        } catch {
          if (errorText.length > 0 && errorText.length < 200) {
            errorMessage = errorText;
          }
        }

        if (response.status === 401) {
          errorMessage += '\n\nPlease check:\n- Username/User ID is correct\n- Password is correct\n- Account is not locked or disabled';
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Authentication failed')) throw error;

      let errorMessage = 'Login failed due to network error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Login request timed out - please check your network connection and try again';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Cannot connect to server - please check your network connection';
        } else {
          errorMessage = `Login error: ${error.message}`;
        }
      }
      throw new Error(errorMessage);
    }
  }

  async logout(): Promise<void> {
    if (this.accessToken) {
      try {
        await fetch(`${BASE_URL}/v1/oauth2/token/${this.accessToken}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json',
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('admin_role');
  }

  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) throw new Error('No access token available');

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        if (this.refreshToken) {
          try {
            await this.refreshAccessToken();
            return this.makeAuthenticatedRequest(endpoint, options);
          } catch {
            this.logout();
            throw new Error('Session expired. Please login again.');
          }
        } else {
          this.logout();
          throw new Error('Authentication required');
        }
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out after 15 seconds');
      }
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) throw new Error('No refresh token available');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${BASE_URL}/v1/oauth2/refreshToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Token refresh failed');

      const authResponse: AuthResponse = await response.json();
      this.accessToken = authResponse.access_token;
      this.refreshToken = authResponse.refresh_token;
      localStorage.setItem('access_token', authResponse.access_token);
      localStorage.setItem('refresh_token', authResponse.refresh_token);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Token refresh timed out');
      }
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAdminRole(): string | null {
    return localStorage.getItem('admin_role');
  }

  async testConnectivity(): Promise<{ success: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
        method: 'OPTIONS',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 405) {
        return { success: true, message: 'API server is reachable' };
      }
      return { success: false, message: `Server responded with ${response.status}: ${response.statusText}` };
    } catch (error) {
      let message = 'Cannot reach API server';
      if (error instanceof Error) {
        if (error.name === 'AbortError') message = 'Connection test timed out - server may be unreachable';
        else message = error.message;
      }
      return { success: false, message };
    }
  }
}

export const apiService = new ApiService();
