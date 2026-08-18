/**
 * GatewayApiClient - the single place feature code goes through to talk
 * to a Gateway. The browser never contacts a Gateway directly; every
 * request is routed through this app's own backend at
 * /api/gateways/<id>/proxy/<real-gateway-path>, which owns TLS trust
 * decisions, timeouts, and safe logging (see server/proxy.js).
 *
 * Tokens are scoped per Gateway ID in localStorage so switching the
 * active Gateway can never accidentally reuse another Gateway's
 * session. Gateway *passwords* are never stored here - only the
 * short-lived bearer tokens issued by the Gateway itself.
 */

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  idle_timeout: number;
  refresh_token: string;
  adminRole: string;
}

function tokenKey(gatewayId: string, name: string) {
  return `gateway:${gatewayId}:${name}`;
}

class ApiService {
  private gatewayId: string | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  /** Must be called whenever the active Gateway changes (see GatewayContext). */
  setActiveGateway(gatewayId: string | null): void {
    this.gatewayId = gatewayId;
    if (gatewayId) {
      this.accessToken = localStorage.getItem(tokenKey(gatewayId, 'access_token'));
      this.refreshToken = localStorage.getItem(tokenKey(gatewayId, 'refresh_token'));
    } else {
      this.accessToken = null;
      this.refreshToken = null;
    }
  }

  getActiveGateway(): string | null {
    return this.gatewayId;
  }

  private requireGateway(): string {
    if (!this.gatewayId) throw new Error('No Gateway selected. Choose an active Gateway first.');
    return this.gatewayId;
  }

  private baseUrl(): string {
    return `/api/gateways/${this.requireGateway()}/proxy/management`;
  }

  async login(userId: string, password: string): Promise<AuthResponse> {
    if (!userId.trim()) throw new Error('User ID is required');
    if (!password.trim()) throw new Error('Password is required');
    const gatewayId = this.requireGateway();

    const requestBody = {
      grantType: 'password',
      userId: userId.trim(),
      password: password,
      scope: '',
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.baseUrl()}/v1/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const authResponse: AuthResponse = await response.json();
        this.accessToken = authResponse.access_token;
        this.refreshToken = authResponse.refresh_token;
        localStorage.setItem(tokenKey(gatewayId, 'access_token'), authResponse.access_token);
        localStorage.setItem(tokenKey(gatewayId, 'refresh_token'), authResponse.refresh_token);
        localStorage.setItem(tokenKey(gatewayId, 'admin_role'), authResponse.adminRole ?? '');
        return authResponse;
      }

      const errorText = await response.text();
      let errorMessage = 'Authentication failed';
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.errors && errorData.errors.length > 0) {
          errorMessage = errorData.errors[0].errorMessage || errorMessage;
        }
      } catch {
        if (errorText.length > 0 && errorText.length < 200) errorMessage = errorText;
      }
      if (response.status === 401) {
        errorMessage += '\n\nPlease check:\n- Username/User ID is correct\n- Password is correct\n- Account is not locked or disabled';
      }
      throw new Error(errorMessage);
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
    const gatewayId = this.gatewayId;
    if (this.accessToken && gatewayId) {
      try {
        await fetch(`${this.baseUrl()}/v1/oauth2/token/${this.accessToken}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    this.accessToken = null;
    this.refreshToken = null;
    if (gatewayId) {
      localStorage.removeItem(tokenKey(gatewayId, 'access_token'));
      localStorage.removeItem(tokenKey(gatewayId, 'refresh_token'));
      localStorage.removeItem(tokenKey(gatewayId, 'admin_role'));
    }
  }

  async makeAuthenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    if (!this.accessToken) throw new Error('No access token available');

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl()}${endpoint}`, {
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
            await this.logout();
            throw new Error('Session expired. Please login again.');
          }
        } else {
          await this.logout();
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
    const gatewayId = this.requireGateway();
    if (!this.refreshToken) throw new Error('No refresh token available');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl()}/v1/oauth2/refreshToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Token refresh failed');

      const authResponse: AuthResponse = await response.json();
      this.accessToken = authResponse.access_token;
      this.refreshToken = authResponse.refresh_token;
      localStorage.setItem(tokenKey(gatewayId, 'access_token'), authResponse.access_token);
      localStorage.setItem(tokenKey(gatewayId, 'refresh_token'), authResponse.refresh_token);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Token refresh timed out');
      throw error;
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getAdminRole(): string | null {
    if (!this.gatewayId) return null;
    return localStorage.getItem(tokenKey(this.gatewayId, 'admin_role'));
  }
}

export const apiService = new ApiService();
