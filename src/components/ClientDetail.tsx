import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { 
  Smartphone, 
  Wifi, 
  Shield, 
  Clock, 
  Activity,
  Signal,
  MapPin,
  Globe,
  RefreshCw,
  Ban,
  RotateCcw,
  Settings
} from 'lucide-react';
import { apiService, Station } from '../services/api';
import { toast } from 'sonner';

interface ClientDetailProps {
  macAddress: string;
}

export function ClientDetail({ macAddress }: ClientDetailProps) {
  const [clientDetails, setClientDetails] = useState<Station | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadClientDetails = async () => {
    try {
      setIsLoading(true);
      const details = await apiService.getStation(macAddress);
      setClientDetails(details);
    } catch (error) {
      console.error('Failed to load client details:', error);
      toast.error('Failed to load client details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadClientDetails();
    setIsRefreshing(false);
    toast.success('Client details refreshed');
  };

  const handleDisassociate = async () => {
    try {
      await apiService.disassociateStations([macAddress]);
      toast.success('Client disassociated successfully');
      await loadClientDetails();
    } catch (error) {
      toast.error('Failed to disassociate client');
    }
  };

  const handleReauthenticate = async () => {
    try {
      await apiService.reauthenticateStation(macAddress);
      toast.success('Client reauthentication initiated');
    } catch (error) {
      toast.error('Failed to reauthenticate client');
    }
  };

  useEffect(() => {
    loadClientDetails();
  }, [macAddress]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!clientDetails) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load client details</p>
      </div>
    );
  }

  const getStatusBadgeVariiant = (status?: string) => {
    if (!status) return 'secondary';
    const s = status.toLowerCase();
    if (s === 'connected' || s === 'associated' || s === 'online') return 'default';
    if (s === 'disconnected' || s === 'offline') return 'destructive';
    return 'secondary';
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (duration?: string) => {
    if (!duration) return 'N/A';
    return duration;
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Client Details</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Connection Status</span>
            <Badge variant={getStatusBadgeVariiant(clientDetails.status)}>
              {clientDetails.status || 'Unknown'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Signal className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Signal Strength</p>
                <p className="font-medium">
                  {clientDetails.signalStrength ? `${clientDetails.signalStrength} dBm` : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Data Rate</p>
                <p className="font-medium">{clientDetails.rxRate || clientDetails.dataRate || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Session Duration</p>
                <p className="font-medium">{formatDuration(clientDetails.sessionDuration)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Protocol</p>
                <p className="font-medium">{clientDetails.protocol || 'N/A'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-4 w-4" />
            <span>Device Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hostname:</span>
              <span className="font-medium">{clientDetails.hostName || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">MAC Address:</span>
              <span className="font-mono text-xs">{clientDetails.macAddress}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IP Address:</span>
              <span className="font-mono text-xs">{clientDetails.ipAddress || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IPv6 Address:</span>
              <span className="font-mono text-xs">{clientDetails.ipv6Address || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Device Type:</span>
              <span className="font-medium">{clientDetails.deviceType || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Manufacturer:</span>
              <span className="font-medium">{clientDetails.manufacturer || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{clientDetails.username || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium">{clientDetails.role || 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Network Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="h-4 w-4" />
            <span>Network Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">SSID:</span>
              <span className="font-medium">{clientDetails.ssid || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network:</span>
              <span className="font-medium">{clientDetails.network || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VLAN:</span>
              <span className="font-medium">{clientDetails.vlan || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Channel:</span>
              <span className="font-medium">{clientDetails.channel || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Site:</span>
              <span className="font-medium">{clientDetails.siteName || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Access Point:</span>
              <span className="font-medium">{clientDetails.apName || clientDetails.apDisplayName || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AP Serial:</span>
              <span className="font-mono text-xs">{clientDetails.apSerial || clientDetails.apSerialNumber || 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Traffic Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-4 w-4" />
            <span>Traffic Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <p className="text-muted-foreground">TX Bytes</p>
              <p className="font-medium">{formatBytes(clientDetails.txBytes)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">RX Bytes</p>
              <p className="font-medium">{formatBytes(clientDetails.rxBytes)}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Out Packets</p>
              <p className="font-medium">{clientDetails.outPackets || 'N/A'}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Total Packets</p>
              <p className="font-medium">{clientDetails.packets || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Time Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Association Time:</span>
              <span className="font-medium">{clientDetails.associationTime || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Seen:</span>
              <span className="font-medium">{clientDetails.lastSeen || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Activity:</span>
              <span className="font-medium">{clientDetails.lastActivity || 'N/A'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Management Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={handleReauthenticate}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reauthenticate Client
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="justify-start"
              onClick={handleDisassociate}
            >
              <Ban className="h-4 w-4 mr-2" />
              Disassociate Client
            </Button>
            <Button variant="outline" size="sm" className="justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Add to Allow List
            </Button>
            <Button variant="outline" size="sm" className="justify-start">
              <Ban className="h-4 w-4 mr-2" />
              Add to Deny List
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}