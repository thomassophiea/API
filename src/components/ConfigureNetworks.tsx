import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Checkbox } from './ui/checkbox';
import { AlertCircle, Wifi, Search, RefreshCw, Filter, Plus, Edit, Trash2, Eye, EyeOff, Shield, Radio, Settings, Network, Users, Globe, Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { NetworkEditDetail } from './NetworkEditDetail';
import { apiService, Service, Role } from '../services/api';
import { toast } from 'sonner';

interface NetworkConfig {
  id: string;
  name: string;
  ssid: string;
  securityType: string;
  vlanId?: number;
  band?: string;
  enabled: boolean;
  hidden?: boolean;
  maxClients?: number;
  currentClients: number;
  captivePortal?: boolean;
  guestAccess?: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

// Helper function to transform service data to network config
const transformServiceToNetwork = (service: Service, clientCount = 0): NetworkConfig => {
  // Debug: Log the actual service data to understand the structure
  console.log('Service data for mapping:', {
    id: service.id,
    name: service.name,
    dot1dPortNumber: service.dot1dPortNumber,
    WpaPskElement: service.WpaPskElement,
    vlan: service.vlan,
    security: service.security
  });

  return {
    id: service.id,
    name: service.name,
    ssid: service.ssid || service.name,
    securityType: 'Open', // Simplified for now
    vlanId: service.dot1dPortNumber || service.vlan || service.vlanId,
    band: '2.4/5 GHz', // Simplified for now
    enabled: service.enabled !== false, // Default to true if not specified
    hidden: service.hidden || service.broadcastSSID === false,
    maxClients: service.maxClients || service.maxUsers || 0,
    currentClients: clientCount,
    captivePortal: service.captivePortal || service.webPortal || false,
    guestAccess: service.guestAccess || service.guest || false,
    description: service.description,
    createdAt: service.createdAt || service.createTime,
    updatedAt: service.updatedAt || service.updateTime,
    ...service // Include all original service properties
  };
};

export function ConfigureNetworks() {
  const [networks, setNetworks] = useState<NetworkConfig[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [filterBand, setFilterBand] = useState<string>('all');
  const [filterSecurity, setFilterSecurity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedNetworkId, setExpandedNetworkId] = useState<string | null>(null);

  useEffect(() => {
    loadNetworks();
  }, []);

  const loadNetworks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add timeout wrapper to prevent hanging
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000)
      );
      
      // Load services and roles in parallel with timeout
      const [servicesResponse, rolesResponse] = await Promise.race([
        Promise.allSettled([
          apiService.getServices(),
          apiService.getRoles()
        ]),
        timeoutPromise
      ]) as [PromiseSettledResult<any>, PromiseSettledResult<any>];

      let loadedServices: Service[] = [];
      let loadedRoles: Role[] = [];

      if (servicesResponse.status === 'fulfilled') {
        loadedServices = servicesResponse.value;
        setServices(loadedServices);
      } else {
        console.warn('Failed to load services:', servicesResponse.reason);
      }

      if (rolesResponse.status === 'fulfilled') {
        loadedRoles = rolesResponse.value;
        setRoles(loadedRoles);
      } else {
        console.warn('Failed to load roles:', rolesResponse.reason);
      }

      // Transform services to network configurations
      const networkConfigs: NetworkConfig[] = [];
      
      // Get all stations in one call to avoid per-service API calls (with timeout)
      let allStations: any[] = [];
      try {
        const stationsTimeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Stations request timed out')), 10000)
        );
        
        allStations = await Promise.race([
          apiService.getStations(),
          stationsTimeoutPromise
        ]) as any[];
      } catch (stationsError) {
        console.warn('Failed to get all stations, will use zero client counts:', stationsError);
        // If it's a session expiration, let it bubble up to be handled by the app
        if (stationsError instanceof Error && stationsError.message.includes('Session expired')) {
          throw stationsError;
        }
        // For other errors, continue with empty array to avoid breaking the entire flow
        allStations = [];
      }
      
      for (const service of loadedServices) {
        try {
          // Count clients for this service from the global stations list
          let clientCount = 0;
          if (allStations.length > 0) {
            // Count stations that belong to this service
            clientCount = allStations.filter(station => {
              // Try different possible service ID fields
              return station.serviceId === service.id || 
                     station.service === service.id ||
                     station.serviceName === service.name ||
                     station.ssid === service.ssid ||
                     station.ssid === service.name;
            }).length;
          }

          const networkConfig = transformServiceToNetwork(service, clientCount);
          networkConfigs.push(networkConfig);
        } catch (transformError) {
          console.warn(`Failed to transform service ${service.id}:`, transformError);
        }
      }

      setNetworks(networkConfigs);

      if (networkConfigs.length === 0 && loadedServices.length === 0) {
        // If no data at all, show a helpful message
        if (servicesResponse.status === 'rejected') {
          throw new Error(servicesResponse.reason?.message || 'Failed to load network services');
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load networks';
      setError(errorMessage);
      
      // Don't show toast for session expiration - let App.tsx handle it
      if (!errorMessage.includes('Session expired')) {
        toast.error('Failed to load networks', {
          description: errorMessage
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredNetworks = networks.filter(network => {
    const matchesSearch = 
      network.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      network.ssid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      network.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBand = filterBand === 'all' || 
                       network.band === filterBand || 
                       (filterBand === 'Both' && (network.band?.toLowerCase().includes('both') || network.band?.toLowerCase().includes('dual') || network.band?.toLowerCase().includes('+')));
    
    const matchesSecurity = filterSecurity === 'all' || 
                           network.securityType?.toLowerCase().includes(filterSecurity.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'enabled' && network.enabled) ||
                         (filterStatus === 'disabled' && !network.enabled);
    
    return matchesSearch && matchesBand && matchesSecurity && matchesStatus;
  });

  const handleToggleNetwork = async (networkId: string, enabled: boolean) => {
    try {
      // Find the original service to update
      const service = services.find(s => s.id === networkId);
      if (!service) {
        throw new Error('Service not found');
      }

      // Update the service via API
      await apiService.updateService(networkId, { ...service, enabled });
      
      // Update local state
      setNetworks(prev => prev.map(network => 
        network.id === networkId ? { ...network, enabled } : network
      ));
      
      setServices(prev => prev.map(service => 
        service.id === networkId ? { ...service, enabled } : service
      ));
      
      toast.success(`Network ${enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update network status';
      toast.error('Failed to update network status', {
        description: errorMessage
      });
    }
  };

  const handleDeleteNetwork = async (networkId: string) => {
    const network = networks.find(n => n.id === networkId);
    if (!confirm(`Are you sure you want to delete the network "${network?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete the service via API
      await apiService.deleteService(networkId);
      
      // Update local state
      setNetworks(prev => prev.filter(network => network.id !== networkId));
      setServices(prev => prev.filter(service => service.id !== networkId));
      setSelectedNetworks(prev => prev.filter(id => id !== networkId));
      
      // Close expanded view if this network was expanded
      if (expandedNetworkId === networkId) {
        setExpandedNetworkId(null);
      }
      
      toast.success('Network deleted successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete network';
      toast.error('Failed to delete network', {
        description: errorMessage
      });
    }
  };

  const handleSelectNetwork = (networkId: string, selected: boolean) => {
    if (selected) {
      setSelectedNetworks(prev => [...prev, networkId]);
    } else {
      setSelectedNetworks(prev => prev.filter(id => id !== networkId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedNetworks(filteredNetworks.map(network => network.id));
    } else {
      setSelectedNetworks([]);
    }
  };

  const handleToggleExpanded = (networkId: string) => {
    setExpandedNetworkId(expandedNetworkId === networkId ? null : networkId);
  };

  const handleNetworkSaved = () => {
    // Refresh the networks list after a save
    loadNetworks();
    toast.success('Network configuration saved successfully');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-10 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Network className="h-5 w-5" />
                <span>Network Configurations</span>
              </CardTitle>
              <CardDescription>
                Manage and configure wireless networks, SSIDs, and security policies using Services API
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={loadNetworks}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Network
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Network</DialogTitle>
                    <DialogDescription>
                      Configure a new wireless network with security and access policies
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-muted-foreground">Network creation form would go here...</p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search networks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={filterBand} onValueChange={setFilterBand}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All Bands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bands</SelectItem>
                  <SelectItem value="2.4GHz">2.4GHz</SelectItem>
                  <SelectItem value="5GHz">5GHz</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterSecurity} onValueChange={setFilterSecurity}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Security" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Security</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="WPA2-PSK">WPA2-PSK</SelectItem>
                  <SelectItem value="WPA3-PSK">WPA3-PSK</SelectItem>
                  <SelectItem value="WPA2-Enterprise">WPA2-Enterprise</SelectItem>
                  <SelectItem value="WPA3-Enterprise">WPA3-Enterprise</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[120px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {selectedNetworks.length > 0 && (
              <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                <span className="text-sm">
                  {selectedNetworks.length} network{selectedNetworks.length === 1 ? '' : 's'} selected
                </span>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Bulk Actions
                </Button>
              </div>
            )}
          </div>

          {/* Networks Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedNetworks.length === filteredNetworks.length && filteredNetworks.length > 0}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all networks"
                    />
                  </TableHead>
                  <TableHead>SSID</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNetworks.map((network) => (
                  <React.Fragment key={network.id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox
                          checked={selectedNetworks.includes(network.id)}
                          onCheckedChange={(checked) => handleSelectNetwork(network.id, !!checked)}
                          aria-label={`Select ${network.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm">{network.ssid}</span>
                          {network.hidden && (
                            <EyeOff className="h-3 w-3 text-muted-foreground" title="Hidden SSID" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {network.currentClients || 0}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={network.enabled ? 'default' : 'secondary'}>
                          {network.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleNetwork(network.id, !network.enabled)}
                            title={network.enabled ? 'Disable Network' : 'Enable Network'}
                          >
                            {network.enabled ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Configure Network"
                            onClick={() => handleToggleExpanded(network.id)}
                          >
                            {expandedNetworkId === network.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <Edit className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteNetwork(network.id)}
                            className="text-destructive hover:text-destructive"
                            title="Delete Network"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Configuration Panel */}
                    {expandedNetworkId === network.id && (
                      <TableRow>
                        <TableCell colSpan={5} className="p-0">
                          <div className="border-t bg-muted/30">
                            <NetworkEditDetail 
                              serviceId={network.id} 
                              onSave={handleNetworkSaved}
                              isInline={true}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
                
                {filteredNetworks.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2 text-muted-foreground">
                        <Network className="h-8 w-8" />
                        <span>No networks found</span>
                        {searchTerm && (
                          <span className="text-sm">
                            Try adjusting your search or filters
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Networks</span>
                </div>
                <p className="text-2xl font-semibold mt-1">{networks.length}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Enabled</span>
                </div>
                <p className="text-2xl font-semibold mt-1">
                  {networks.filter(n => n.enabled).length}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Total Clients</span>
                </div>
                <p className="text-2xl font-semibold mt-1">
                  {networks.reduce((sum, network) => sum + (network.currentClients || 0), 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}