const BASE_URL = 'https://tsophiea.ddns.net:443/management';

export interface LoginCredentials {
  grant_type: string;
  username: string;
  password: string;
  scope?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  idle_timeout: number;
  refresh_token: string;
  adminRole: string;
}

export interface ApiError {
  message: string;
  status: number;
}

export interface AccessPoint {
  serialNumber: string;
  displayName?: string;
  model?: string;
  hardwareType?: string;
  status?: string;
  ipAddress?: string;
  macAddress?: string;
  location?: string;
  site?: string;
  firmware?: string;
  clientCount?: number;
  [key: string]: any;
}

export interface APQueryColumn {
  name: string;
  displayName?: string;
  type?: string;
  description?: string;
}

export interface APStation {
  macAddress: string;
  ipAddress?: string;
  hostName?: string;
  status?: string;
  associationTime?: string;
  signalStrength?: number;
  dataRate?: string;
  vlan?: string;
  [key: string]: any;
}

export interface Station {
  // Basic identification
  macAddress: string;
  ipAddress?: string;
  ipv6Address?: string;
  hostName?: string;
  status?: string;
  
  // Device information
  deviceType?: string;
  manufacturer?: string;
  username?: string;
  role?: string;
  
  // Network information
  siteName?: string;
  network?: string;
  ssid?: string;
  
  // Access Point information
  apName?: string;
  apSerial?: string;
  
  // Connection details
  channel?: number;
  capabilities?: string;
  signalStrength?: number;
  rxRate?: string;
  protocol?: string;
  
  // Traffic statistics
  clientBandwidthBytes?: number;
  packets?: number;
  outBytes?: number;
  outPackets?: number;
  rxBytes?: number;
  txBytes?: number;
  
  // Timing information
  lastSeen?: string;
  associationTime?: string;
  sessionDuration?: string;
  
  // Rating/Quality
  siteRating?: number;
  
  // Legacy/Additional fields
  dataRate?: string;
  vlan?: string;
  apSerialNumber?: string;
  apDisplayName?: string;
  apIpAddress?: string;
  authMethod?: string;
  encryption?: string;
  radioType?: string;
  txPower?: number;
  lastActivity?: string;
  
  [key: string]: any;
}

export interface APDetails extends AccessPoint {
  uptime?: string;
  memoryUsage?: number;
  cpuUsage?: number;
  channelUtilization?: number;
  txPower?: number;
  channel?: number;
  associatedClients?: number;
  [key: string]: any;
}

export interface APPlatform {
  name: string;
  description?: string;
  [key: string]: any;
}

export interface APHardwareType {
  name: string;
  description?: string;
  [key: string]: any;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  ssid?: string;
  security?: {
    type?: string;
    privacyType?: string;
    authType?: string;
    authMethod?: string;
    encryption?: string;
    passphrase?: string;
    [key: string]: any;
  };
  vlan?: number;
  band?: string;
  maxClients?: number;
  hidden?: boolean;
  captivePortal?: boolean;
  guestAccess?: boolean;
  // API server specific fields
  dot1dPortNumber?: number; // VLAN ID
  WpaPskElement?: {
    mode?: string; // Security mode like "aesOnly"
    [key: string]: any;
  };
  // Additional security-related fields that might exist at the service level
  privacyType?: string;
  authType?: string;
  authMethod?: string;
  encryption?: string;
  securityMode?: string;
  securityType?: string;
  [key: string]: any;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  [key: string]: any;
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Load tokens from localStorage on initialization
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  async login(userId: string, password: string): Promise<AuthResponse> {
    // Validate inputs
    if (!userId.trim()) {
      throw new Error('User ID is required');
    }
    if (!password.trim()) {
      throw new Error('Password is required');
    }

    // Based on error analysis, use standard OAuth2 parameter names
    // Many OAuth2 implementations expect snake_case (grant_type, username)
    const requestBody = {
      grant_type: 'password',
      username: userId.trim(),
      password: password,
      scope: ''
    };

    try {
      console.log('Attempting login with JSON format...');
      
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for login

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
        
        // Store tokens
        this.accessToken = authResponse.access_token;
        this.refreshToken = authResponse.refresh_token;
        localStorage.setItem('access_token', authResponse.access_token);
        localStorage.setItem('refresh_token', authResponse.refresh_token);
        localStorage.setItem('admin_role', authResponse.adminRole);

        console.log('Login successful');
        return authResponse;
      } else {
        const errorText = await response.text();
        let errorMessage = 'Authentication failed';
        
        // Try to parse structured error response
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && errorData.errors.length > 0) {
            const firstError = errorData.errors[0];
            errorMessage = firstError.errorMessage || errorMessage;
          }
        } catch (parseError) {
          // If parsing fails, use the raw error text if it's reasonable length
          if (errorText.length > 0 && errorText.length < 200) {
            errorMessage = errorText;
          }
        }
        
        // Add specific error guidance
        if (response.status === 401) {
          errorMessage += '\n\nPlease check:\n• Username/User ID is correct\n• Password is correct\n• Account is not locked or disabled';
        } else if (response.status === 422) {
          errorMessage += '\n\nValidation error - please ensure all login fields are properly filled';
        } else if (response.status === 415) {
          errorMessage += '\n\nServer rejected the request format';
        } else {
          errorMessage += `\n\nServer responded with status ${response.status}`;
        }
        
        console.error('Login failed:', { status: response.status, response: errorText });
        throw new Error(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Authentication failed')) {
        throw error; // Re-throw authentication errors as-is
      }
      
      // Handle network errors
      let errorMessage = 'Login failed due to network error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Login request timed out - please check your network connection and try again';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Cannot connect to server - please check your network connection';
        } else if (error.message.includes('CORS')) {
          errorMessage = 'Server blocked the request due to CORS policy';
        } else {
          errorMessage = `Login error: ${error.message}`;
        }
      }
      
      console.error('Login network error:', error);
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

    // Clear tokens
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('admin_role');
  }

  async makeAuthenticatedRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const headers = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Check for authentication errors
      if (response.status === 401) {
        // Token expired, try to refresh
        if (this.refreshToken) {
          try {
            await this.refreshAccessToken();
            // Retry the request with new token
            return this.makeAuthenticatedRequest(endpoint, options);
          } catch (refreshError) {
            // Refresh failed, user needs to login again
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
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(`${BASE_URL}/v1/oauth2/refreshToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken,
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

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

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getAdminRole(): string | null {
    return localStorage.getItem('admin_role');
  }

  // Test basic connectivity to the API server
  async testConnectivity(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log('Testing connectivity to API server...');
      
      // Test basic HTTPS connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for connectivity test

      const response = await fetch(`${BASE_URL}/v1/oauth2/token`, {
        method: 'OPTIONS',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok || response.status === 405) {
        // 405 Method Not Allowed is expected for OPTIONS, but means the endpoint exists
        return {
          success: true,
          message: 'API server is reachable',
          details: {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries())
          }
        };
      } else {
        return {
          success: false,
          message: `Server responded with ${response.status}: ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText
          }
        };
      }
    } catch (error) {
      let message = 'Cannot reach API server';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message = 'Connection test timed out - server may be unreachable';
        } else if (error.message.includes('CORS')) {
          message = 'CORS policy blocking request - check server configuration';
        } else if (error.message.includes('network')) {
          message = 'Network error - check internet connection';
        } else if (error.message.includes('certificate') || error.message.includes('SSL')) {
          message = 'SSL/Certificate error - check HTTPS configuration';
        } else {
          message = error.message;
        }
      }
      
      return {
        success: false,
        message,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  // Access Points API methods
  async getAccessPoints(): Promise<AccessPoint[]> {
    const response = await this.makeAuthenticatedRequest('/v1/aps');
    if (!response.ok) {
      throw new Error(`Failed to fetch access points: ${response.status}`);
    }
    return await response.json();
  }

  async getAPQueryColumns(): Promise<APQueryColumn[]> {
    try {
      const response = await this.makeAuthenticatedRequest('/v1/aps/query/columns');
      if (!response.ok) {
        throw new Error(`Failed to fetch AP query columns: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('AP query columns endpoint not available:', error);
      return [];
    }
  }

  async queryAccessPoints(query?: any): Promise<AccessPoint[]> {
    // If no specific query is provided, use the basic endpoint
    if (!query || Object.keys(query).length === 0) {
      return this.getAccessPoints();
    }
    
    // Try the query endpoint for advanced filtering
    try {
      const response = await this.makeAuthenticatedRequest('/v1/aps/query', {
        method: 'POST',
        body: JSON.stringify(query)
      });
      if (!response.ok) {
        // If query endpoint fails, fall back to basic endpoint
        console.warn('Query endpoint failed, falling back to basic AP list');
        return this.getAccessPoints();
      }
      return await response.json();
    } catch (error) {
      // If query endpoint fails, fall back to basic endpoint
      console.warn('Query endpoint error, falling back to basic AP list:', error);
      return this.getAccessPoints();
    }
  }

  async getAccessPointDetails(serialNumber: string): Promise<APDetails> {
    const response = await this.makeAuthenticatedRequest(`/v1/aps/${encodeURIComponent(serialNumber)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch AP details: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }

  async getAccessPointStations(serialNumber: string): Promise<APStation[]> {
    const response = await this.makeAuthenticatedRequest(`/v1/aps/${encodeURIComponent(serialNumber)}/stations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch AP stations: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getAPPlatforms(): Promise<APPlatform[]> {
    const response = await this.makeAuthenticatedRequest('/v1/aps/platforms');
    if (!response.ok) {
      throw new Error(`Failed to fetch AP platforms: ${response.status}`);
    }
    return await response.json();
  }

  async getAPHardwareTypes(): Promise<APHardwareType[]> {
    const response = await this.makeAuthenticatedRequest('/v1/aps/hardwaretypes');
    if (!response.ok) {
      throw new Error(`Failed to fetch AP hardware types: ${response.status}`);
    }
    return await response.json();
  }

  async getAPDisplayNames(): Promise<any> {
    const response = await this.makeAuthenticatedRequest('/v1/aps/displaynames');
    if (!response.ok) {
      throw new Error(`Failed to fetch AP display names: ${response.status}`);
    }
    return await response.json();
  }

  async getAPDefaults(hardwareType?: string): Promise<any> {
    const endpoint = hardwareType 
      ? `/v1/aps/default?hardwareType=${encodeURIComponent(hardwareType)}`
      : '/v1/aps/default';
    const response = await this.makeAuthenticatedRequest(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch AP defaults: ${response.status}`);
    }
    return await response.json();
  }

  // Stations/Clients API methods
  async getAllStations(): Promise<Station[]> {
    const response = await this.makeAuthenticatedRequest('/v1/stations');
    if (!response.ok) {
      throw new Error(`Failed to fetch stations: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  // Alias for getAllStations to maintain compatibility
  async getStations(): Promise<Station[]> {
    return this.getAllStations();
  }

  // Services API methods
  async getServices(): Promise<Service[]> {
    const response = await this.makeAuthenticatedRequest('/v1/services');
    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getServiceById(serviceId: string): Promise<Service> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch service: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async updateService(serviceId: string, serviceData: Partial<Service>): Promise<Service> {
    console.log('Updating service:', {
      serviceId,
      url: `${BASE_URL}/v1/services/${encodeURIComponent(serviceId)}`,
      payload: serviceData
    });
    
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData)
    });
    
    console.log('Service update response:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to update service: ${response.status} ${response.statusText}`;
      let errorDetails = '';
      let fullErrorResponse = '';
      
      try {
        const errorResponse = await response.text();
        fullErrorResponse = errorResponse;
        console.error('Full service update error response:', {
          status: response.status,
          statusText: response.statusText,
          responseText: errorResponse,
          responseLength: errorResponse.length
        });
        
        // Try to parse structured error response
        if (errorResponse) {
          try {
            const errorData = JSON.parse(errorResponse);
            console.error('Parsed error data:', errorData);
            
            if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
              const firstError = errorData.errors[0];
              errorMessage = firstError.errorMessage || firstError.message || errorMessage;
              errorDetails = firstError.details || firstError.resource || firstError.field || '';
              
              // Log all error details for debugging
              console.error('Detailed error info:', {
                errorMessage: firstError.errorMessage,
                message: firstError.message,
                details: firstError.details,
                resource: firstError.resource,
                field: firstError.field,
                code: firstError.code,
                fullError: firstError
              });
            } else if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
            }
            
            // Include any validation errors
            if (errorData.validationErrors) {
              errorDetails += ` Validation errors: ${JSON.stringify(errorData.validationErrors)}`;
            }
            
          } catch (parseError) {
            console.error('Failed to parse error response as JSON:', parseError);
            // If parsing fails, use the raw error text if it's reasonable length
            if (errorResponse.length > 0 && errorResponse.length < 1000) {
              errorDetails = errorResponse;
            }
          }
        }
        
        // Add specific guidance for different error codes
        if (response.status === 422) {
          errorMessage += ' - Validation failed';
          if (errorDetails) {
            errorMessage += `: ${errorDetails}`;
          } else if (fullErrorResponse) {
            errorMessage += `. Server response: ${fullErrorResponse.substring(0, 200)}${fullErrorResponse.length > 200 ? '...' : ''}`;
          } else {
            errorMessage += '. Check that all field values are valid and within acceptable ranges.';
          }
        } else if (response.status === 400) {
          errorMessage += ' - Bad request. Check the request format and required fields.';
        } else if (response.status === 403) {
          errorMessage += ' - Access denied. You may not have permission to update this service.';
        } else if (response.status === 404) {
          errorMessage += ' - Service not found. The service may have been deleted.';
        }
        
      } catch (textError) {
        console.error('Error reading response text:', textError);
        errorMessage += ` (Unable to read error details: ${textError.message})`;
      }
      
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('Service update successful:', result);
    return result;
  }

  async createService(serviceData: Partial<Service>): Promise<Service> {
    const response = await this.makeAuthenticatedRequest('/v1/services', {
      method: 'POST',
      body: JSON.stringify(serviceData)
    });
    if (!response.ok) {
      throw new Error(`Failed to create service: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async deleteService(serviceId: string): Promise<void> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to delete service: ${response.status} ${response.statusText}`);
    }
  }

  async getServiceStations(serviceId: string): Promise<Station[]> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}/stations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch service stations: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  // Roles API methods
  async getRoles(): Promise<Role[]> {
    const response = await this.makeAuthenticatedRequest('/v1/roles');
    if (!response.ok) {
      throw new Error(`Failed to fetch roles: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getRoleById(roleId: string): Promise<Role> {
    const response = await this.makeAuthenticatedRequest(`/v1/roles/${encodeURIComponent(roleId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch role: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async updateRole(roleId: string, roleData: Partial<Role>): Promise<Role> {
    const response = await this.makeAuthenticatedRequest(`/v1/roles/${encodeURIComponent(roleId)}`, {
      method: 'PUT',
      body: JSON.stringify(roleData)
    });
    if (!response.ok) {
      throw new Error(`Failed to update role: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async createRole(roleData: Partial<Role>): Promise<Role> {
    const response = await this.makeAuthenticatedRequest('/v1/roles', {
      method: 'POST',
      body: JSON.stringify(roleData)
    });
    if (!response.ok) {
      throw new Error(`Failed to create role: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async deleteRole(roleId: string): Promise<void> {
    const response = await this.makeAuthenticatedRequest(`/v1/roles/${encodeURIComponent(roleId)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to delete role: ${response.status} ${response.statusText}`);
    }
  }

  async getStation(macAddress: string): Promise<Station> {
    try {
      const response = await this.makeAuthenticatedRequest(`/v1/stations/${encodeURIComponent(macAddress)}`);
      
      if (response.status === 422) {
        throw new Error(`Invalid MAC address format or station not found: ${macAddress}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch station: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        throw new Error(`Error fetching station ${macAddress}: ${error.message}`);
      }
      throw error;
    }
  }

  async queryStations(query: any, version: 'v1' | 'v2' = 'v1'): Promise<Station[]> {
    const response = await this.makeAuthenticatedRequest(`/${version}/stations/query`, {
      method: 'POST',
      body: JSON.stringify(query)
    });
    if (!response.ok) {
      throw new Error(`Failed to query stations: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getStationQueryColumns(version: 'v1' | 'v2' = 'v1'): Promise<any[]> {
    try {
      const response = await this.makeAuthenticatedRequest(`/${version}/stations/query/columns`);
      if (!response.ok) {
        throw new Error(`Failed to fetch station query columns: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.warn('Station query columns endpoint not available:', error);
      return [];
    }
  }

  async visualizeStationQuery(query: any, version: 'v1' | 'v2' = 'v1'): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/${version}/stations/query/visualize`, {
      method: 'POST',
      body: JSON.stringify(query)
    });
    if (!response.ok) {
      throw new Error(`Failed to visualize station query: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async getStationLocation(stationId: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest(`/v1/stations/${encodeURIComponent(stationId)}/location`);
      
      if (response.status === 422) {
        throw new Error(`Invalid station ID format or station not found: ${stationId}`);
      }
      
      if (response.status === 404) {
        throw new Error(`Station location not found for: ${stationId}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch station location: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn(`Error loading location for station ${stationId}:`, error);
      throw error;
    }
  }

  async getStationEvents(macAddress: string): Promise<any[]> {
    try {
      const response = await this.makeAuthenticatedRequest(`/v1/stations/events/${encodeURIComponent(macAddress)}`);
      
      // Handle common error cases gracefully
      if (response.status === 422) {
        // 422 typically means the MAC address format is invalid or the station doesn't exist
        console.warn(`Station events not available for ${macAddress}: Invalid format or station not found`);
        return [];
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch station events: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      // Log the error but don't fail the whole operation
      console.warn(`Error loading station events for ${macAddress}:`, error);
      return [];
    }
  }

  // Station Actions
  async disassociateStations(macAddresses: string[]): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest('/v1/stations/disassociate', {
        method: 'POST',
        body: JSON.stringify({ macAddresses })
      });
      
      if (response.status === 422) {
        throw new Error(`Invalid MAC address format or stations not found: ${macAddresses.join(', ')}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to disassociate stations: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error disassociating stations:', error);
      throw error;
    }
  }

  async deleteStation(macAddress: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/v1/stations/${encodeURIComponent(macAddress)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to delete station: ${response.status} ${response.statusText}`);
    }
    return response.status === 204 ? { success: true } : await response.json();
  }

  async reauthenticateStation(macAddress: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest(`/v1/stations/${encodeURIComponent(macAddress)}/reauthenticate`, {
        method: 'POST'
      });
      
      if (response.status === 422) {
        throw new Error(`Invalid MAC address format or station not found: ${macAddress}`);
      }
      
      if (!response.ok) {
        throw new Error(`Failed to reauthenticate station: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error reauthenticating station ${macAddress}:`, error);
      throw error;
    }
  }

  async addStationToGroup(macAddress: string, groupId: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/v1/stations/${encodeURIComponent(macAddress)}/groups`, {
      method: 'POST',
      body: JSON.stringify({ groupId })
    });
    if (!response.ok) {
      throw new Error(`Failed to add station to group: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async removeStationFromGroup(macAddress: string, groupId: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/v1/stations/${encodeURIComponent(macAddress)}/groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to remove station from group: ${response.status} ${response.statusText}`);
    }
    return response.status === 204 ? { success: true } : await response.json();
  }

  async addStationToAllowList(macAddress: string, siteId: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/v1/sites/${encodeURIComponent(siteId)}/allowlist`, {
      method: 'POST',
      body: JSON.stringify({ macAddress })
    });
    if (!response.ok) {
      throw new Error(`Failed to add station to allow list: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async addStationToDenyList(macAddress: string, siteId: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/v1/sites/${encodeURIComponent(siteId)}/denylist`, {
      method: 'POST',
      body: JSON.stringify({ macAddress })
    });
    if (!response.ok) {
      throw new Error(`Failed to add station to deny list: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async removeStationFromAllowList(macAddress: string, siteId: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/v1/sites/${encodeURIComponent(siteId)}/allowlist/${encodeURIComponent(macAddress)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to remove station from allow list: ${response.status} ${response.statusText}`);
    }
    return response.status === 204 ? { success: true } : await response.json();
  }

  async removeStationFromDenyList(macAddress: string, siteId: string): Promise<any> {
    const response = await this.makeAuthenticatedRequest(`/v1/sites/${encodeURIComponent(siteId)}/denylist/${encodeURIComponent(macAddress)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to remove station from deny list: ${response.status} ${response.statusText}`);
    }
    return response.status === 204 ? { success: true } : await response.json();
  }

  // Bulk operations
  async bulkDisassociateStations(macAddresses: string[]): Promise<any> {
    return this.disassociateStations(macAddresses);
  }

  async bulkDeleteStations(macAddresses: string[]): Promise<any> {
    const results = await Promise.allSettled(
      macAddresses.map(macAddress => this.deleteStation(macAddress))
    );
    
    const successes = results.filter(result => result.status === 'fulfilled').length;
    const failures = results.filter(result => result.status === 'rejected').length;
    
    return {
      total: macAddresses.length,
      successes,
      failures,
      results
    };
  }

  async bulkReauthenticateStations(macAddresses: string[]): Promise<any> {
    const results = await Promise.allSettled(
      macAddresses.map(macAddress => this.reauthenticateStation(macAddress))
    );
    
    const successes = results.filter(result => result.status === 'fulfilled').length;
    const failures = results.filter(result => result.status === 'rejected').length;
    
    return {
      total: macAddresses.length,
      successes,
      failures,
      results
    };
  }

  // Services API methods
  async getServices(): Promise<Service[]> {
    const response = await this.makeAuthenticatedRequest('/v1/services');
    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getServiceById(serviceId: string): Promise<Service> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch service: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async getService(serviceId: string): Promise<Service> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch service: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async createService(service: Partial<Service>): Promise<Service> {
    const response = await this.makeAuthenticatedRequest('/v1/services', {
      method: 'POST',
      body: JSON.stringify(service)
    });
    if (!response.ok) {
      throw new Error(`Failed to create service: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async updateService(serviceId: string, service: Partial<Service>): Promise<Service> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}`, {
      method: 'PUT',
      body: JSON.stringify(service)
    });
    if (!response.ok) {
      throw new Error(`Failed to update service: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async deleteService(serviceId: string): Promise<void> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to delete service: ${response.status} ${response.statusText}`);
    }
  }

  async getDefaultService(): Promise<Service> {
    const response = await this.makeAuthenticatedRequest('/v1/services/default');
    if (!response.ok) {
      throw new Error(`Failed to fetch default service: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async getServiceNameMap(): Promise<any> {
    const response = await this.makeAuthenticatedRequest('/v1/services/nametoidmap');
    if (!response.ok) {
      throw new Error(`Failed to fetch service name map: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async getServiceDeviceIds(serviceId: string): Promise<string[]> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}/deviceids`);
    if (!response.ok) {
      throw new Error(`Failed to fetch service device IDs: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getServiceSiteIds(serviceId: string): Promise<string[]> {
    const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}/siteids`);
    if (!response.ok) {
      throw new Error(`Failed to fetch service site IDs: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getServiceStations(serviceId: string): Promise<Station[]> {
    try {
      const response = await this.makeAuthenticatedRequest(`/v1/services/${encodeURIComponent(serviceId)}/stations`);
      
      if (response.status === 422) {
        // Service might not exist or invalid format
        console.warn(`Service stations not available for service ${serviceId}: Invalid service ID or service not found`);
        return [];
      }
      
      if (response.status === 404) {
        // Service doesn't exist
        console.warn(`Service ${serviceId} not found`);
        return [];
      }
      
      if (!response.ok) {
        throw new Error(`Failed to fetch service stations: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      // Log warning but return empty array to avoid breaking the UI
      console.warn(`Error loading stations for service ${serviceId}:`, error);
      return [];
    }
  }

  // Roles API methods
  async getRoles(): Promise<Role[]> {
    const response = await this.makeAuthenticatedRequest('/v3/roles');
    if (!response.ok) {
      throw new Error(`Failed to fetch roles: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getRole(roleId: string): Promise<Role> {
    const response = await this.makeAuthenticatedRequest(`/v3/roles/${encodeURIComponent(roleId)}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch role: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async createRole(role: Partial<Role>): Promise<Role> {
    const response = await this.makeAuthenticatedRequest('/v3/roles', {
      method: 'POST',
      body: JSON.stringify(role)
    });
    if (!response.ok) {
      throw new Error(`Failed to create role: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async updateRole(roleId: string, role: Partial<Role>): Promise<Role> {
    const response = await this.makeAuthenticatedRequest(`/v3/roles/${encodeURIComponent(roleId)}`, {
      method: 'PUT',
      body: JSON.stringify(role)
    });
    if (!response.ok) {
      throw new Error(`Failed to update role: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async deleteRole(roleId: string): Promise<void> {
    const response = await this.makeAuthenticatedRequest(`/v3/roles/${encodeURIComponent(roleId)}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(`Failed to delete role: ${response.status} ${response.statusText}`);
    }
  }

  async getDefaultRole(): Promise<Role> {
    const response = await this.makeAuthenticatedRequest('/v3/roles/default');
    if (!response.ok) {
      throw new Error(`Failed to fetch default role: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async getRoleNameMap(): Promise<any> {
    const response = await this.makeAuthenticatedRequest('/v3/roles/nametoidmap');
    if (!response.ok) {
      throw new Error(`Failed to fetch role name map: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }
}

export const apiService = new ApiService();