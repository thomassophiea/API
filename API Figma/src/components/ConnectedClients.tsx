import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { AlertCircle, Users, Search, RefreshCw, Filter, Eye, Wifi, Activity, Timer, Signal, Download, Upload, Shield, Router, MapPin, User, Clock, Star, Trash2, UserX, RotateCcw, UserPlus, UserMinus, ShieldCheck, ShieldX, Settings } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { apiService, Station } from '../services/api';
import { identifyClient, lookupVendor, suggestDeviceType } from '../services/ouiLookup';
import { toast } from 'sonner';

interface ConnectedClientsProps {
  onShowDetail?: (macAddress: string, hostName?: string) => void;
}

export function ConnectedClients({ onShowDetail }: ConnectedClientsProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [apFilter, setApFilter] = useState<string>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [deviceTypeFilter, setDeviceTypeFilter] = useState<string>('all');
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStations, setSelectedStations] = useState<Set<string>>(new Set());
  const [isActionsModalOpen, setIsActionsModalOpen] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const [actionType, setActionType] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [siteId, setSiteId] = useState<string>('');
  const [stationEvents, setStationEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  useEffect(() => {
    loadStations();
  }, []);

  const loadStations = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const stationsData = await apiService.getAllStations();
      setStations(Array.isArray(stationsData) ? stationsData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connected clients');
      console.error('Error loading stations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'connected':
      case 'associated':
      case 'active':
        return 'default';
      case 'disconnected':
      case 'inactive':
        return 'destructive';
      case 'idle':
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (duration: string | number) => {
    if (!duration) return 'N/A';
    if (typeof duration === 'string') return duration;
    
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = duration % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const filteredStations = stations.filter((station) => {
    const matchesSearch = !searchTerm || 
      station.macAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.hostName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.apName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.apSerial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.network?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      station.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || station.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesAP = apFilter === 'all' || station.apSerial === apFilter || station.apName === apFilter;
    const matchesSite = siteFilter === 'all' || station.siteName === siteFilter;
    const matchesDeviceType = deviceTypeFilter === 'all' || station.deviceType === deviceTypeFilter;
    
    return matchesSearch && matchesStatus && matchesAP && matchesSite && matchesDeviceType;
  });

  const getUniqueStatuses = () => {
    const statuses = new Set(stations.map(station => station.status).filter(Boolean));
    return Array.from(statuses);
  };

  const getUniqueAPs = () => {
    const aps = new Set(stations.map(station => station.apName || station.apSerial).filter(Boolean));
    return Array.from(aps);
  };

  const getUniqueSites = () => {
    const sites = new Set(stations.map(station => station.siteName).filter(Boolean));
    return Array.from(sites);
  };

  const getUniqueDeviceTypes = () => {
    const deviceTypes = new Set(stations.map(station => station.deviceType).filter(Boolean));
    return Array.from(deviceTypes);
  };

  const getUniqueNetworks = () => {
    const networks = new Set(stations.map(station => station.network).filter(Boolean));
    return Array.from(networks);
  };

  const getTotalTraffic = () => {
    return stations.reduce((total, station) => {
      const rx = station.rxBytes || station.clientBandwidthBytes || 0;
      const tx = station.txBytes || station.outBytes || 0;
      return total + rx + tx;
    }, 0);
  };

  const getActiveClientsCount = () => {
    return stations.filter(station => 
      station.status?.toLowerCase() === 'connected' || 
      station.status?.toLowerCase() === 'associated' ||
      station.status?.toLowerCase() === 'active'
    ).length;
  };

  const getUniqueNetworkCount = () => {
    return getUniqueNetworks().length;
  };

  const getUniqueSiteCount = () => {
    return getUniqueSites().length;
  };

  const handleStationSelect = (macAddress: string, checked: boolean) => {
    const newSelection = new Set(selectedStations);
    if (checked) {
      newSelection.add(macAddress);
    } else {
      newSelection.delete(macAddress);
    }
    setSelectedStations(newSelection);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allMacAddresses = new Set(filteredStations.map(station => station.macAddress));
      setSelectedStations(allMacAddresses);
    } else {
      setSelectedStations(new Set());
    }
  };

  const loadStationEvents = async (macAddress: string) => {
    if (!macAddress) return;
    
    setIsLoadingEvents(true);
    try {
      const events = await apiService.getStationEvents(macAddress);
      setStationEvents(Array.isArray(events) ? events : []);
    } catch (err) {
      // API service now handles 422 gracefully, but catch any other errors
      console.warn('Error loading station events:', err);
      setStationEvents([]);
      // Only show toast for unexpected errors, not 422 which is handled gracefully
      if (err instanceof Error && !err.message.includes('422')) {
        toast.error('Failed to load station events');
      }
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const performBulkAction = async (action: string) => {
    if (selectedStations.size === 0) {
      toast.error('No stations selected');
      return;
    }

    setIsPerformingAction(true);
    const macAddresses = Array.from(selectedStations);

    try {
      let result;
      switch (action) {
        case 'delete':
          result = await apiService.bulkDeleteStations(macAddresses);
          toast.success(`Deleted ${result.successes}/${result.total} stations`);
          break;
        
        case 'disassociate':
          result = await apiService.bulkDisassociateStations(macAddresses);
          toast.success(`Disassociated ${macAddresses.length} stations`);
          break;
        
        case 'reauthenticate':
          result = await apiService.bulkReauthenticateStations(macAddresses);
          toast.success(`Reauthenticated ${result.successes}/${result.total} stations`);
          break;
        
        case 'addToGroup':
          if (!groupId) {
            toast.error('Please specify a Group ID');
            return;
          }
          const addResults = await Promise.allSettled(
            macAddresses.map(mac => apiService.addStationToGroup(mac, groupId))
          );
          const addSuccesses = addResults.filter(r => r.status === 'fulfilled').length;
          toast.success(`Added ${addSuccesses}/${macAddresses.length} stations to group`);
          break;
        
        case 'removeFromGroup':
          if (!groupId) {
            toast.error('Please specify a Group ID');
            return;
          }
          const removeResults = await Promise.allSettled(
            macAddresses.map(mac => apiService.removeStationFromGroup(mac, groupId))
          );
          const removeSuccesses = removeResults.filter(r => r.status === 'fulfilled').length;
          toast.success(`Removed ${removeSuccesses}/${macAddresses.length} stations from group`);
          break;
        
        case 'addToAllowList':
          if (!siteId) {
            toast.error('Please specify a Site ID');
            return;
          }
          const allowResults = await Promise.allSettled(
            macAddresses.map(mac => apiService.addStationToAllowList(mac, siteId))
          );
          const allowSuccesses = allowResults.filter(r => r.status === 'fulfilled').length;
          toast.success(`Added ${allowSuccesses}/${macAddresses.length} stations to allow list`);
          break;
        
        case 'addToDenyList':
          if (!siteId) {
            toast.error('Please specify a Site ID');
            return;
          }
          const denyResults = await Promise.allSettled(
            macAddresses.map(mac => apiService.addStationToDenyList(mac, siteId))
          );
          const denySuccesses = denyResults.filter(r => r.status === 'fulfilled').length;
          toast.success(`Added ${denySuccesses}/${macAddresses.length} stations to deny list`);
          break;
        
        default:
          toast.error('Unknown action');
          return;
      }

      // Clear selection and refresh data
      setSelectedStations(new Set());
      setIsActionsModalOpen(false);
      await loadStations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsPerformingAction(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Connected Clients</h1>
          <p className="text-muted-foreground">Monitor connected devices and network usage</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Connected Clients</h1>
          <p className="text-muted-foreground">Monitor connected devices and network usage</p>
        </div>
        <Button onClick={loadStations} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stations.length}</div>
            <p className="text-xs text-muted-foreground">
              Connected devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Wifi className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getActiveClientsCount()}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sites</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getUniqueSiteCount()}</div>
            <p className="text-xs text-muted-foreground">
              Active sites
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Traffic</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(getTotalTraffic())}</div>
            <p className="text-xs text-muted-foreground">
              Data transferred
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected Clients</CardTitle>
          <CardDescription>
            Click any client to view detailed connection information
          </CardDescription>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {getUniqueStatuses().map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {getUniqueSites().map((site) => (
                  <SelectItem key={site} value={site}>{site}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={deviceTypeFilter} onValueChange={setDeviceTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Device Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {getUniqueDeviceTypes().map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={apFilter} onValueChange={setApFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Access Point" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All APs</SelectItem>
                {getUniqueAPs().map((ap) => (
                  <SelectItem key={ap} value={ap}>{ap}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Connected Clients Found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' || apFilter !== 'all' || siteFilter !== 'all' || deviceTypeFilter !== 'all'
                  ? 'No clients match your current filters.' 
                  : 'No clients are currently connected to the network.'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="h-8">
                    <TableHead className="w-12 p-2 text-[10px]">
                      <Checkbox
                        checked={selectedStations.size === filteredStations.length && filteredStations.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="h-3 w-3"
                      />
                    </TableHead>
                    <TableHead className="w-16 p-2 text-[10px]">Status</TableHead>
                    <TableHead className="w-28 p-2 text-[10px]">Client Info</TableHead>
                    <TableHead className="w-32 p-2 text-[10px]">Device Info</TableHead>
                    <TableHead className="w-28 p-2 text-[10px]">User & Network</TableHead>
                    <TableHead className="w-28 p-2 text-[10px]">Access Point</TableHead>
                    <TableHead className="w-24 p-2 text-[10px]">Connection</TableHead>
                    <TableHead className="w-24 p-2 text-[10px]">Traffic</TableHead>
                    <TableHead className="w-16 p-2 text-[10px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStations.map((station, index) => (
                    <TableRow 
                      key={station.macAddress || index}
                      className="cursor-pointer hover:bg-muted/50 h-10"
                      onClick={(e) => {
                        // Don't trigger row click if clicking on checkbox
                        if ((e.target as HTMLElement).closest('[data-checkbox]')) {
                          return;
                        }
                        if (onShowDetail) {
                          onShowDetail(station.macAddress, station.hostName);
                        } else {
                          setSelectedStation(station);
                          setIsModalOpen(true);
                        }
                      }}
                    >
                      <TableCell className="p-1" data-checkbox>
                        <Checkbox
                          checked={selectedStations.has(station.macAddress)}
                          onCheckedChange={(checked) => handleStationSelect(station.macAddress, checked as boolean)}
                          className="h-3 w-3"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      
                      <TableCell className="p-1">
                        {station.status ? (
                          <Badge variant={getStatusBadgeVariant(station.status)} className="text-[9px] px-1 py-0 h-3 min-h-0">
                            {station.status}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <div>
                          <div className="font-mono text-[9px] leading-none mb-0.5">{station.macAddress}</div>
                          <div className="font-mono text-[8px] text-muted-foreground leading-none mb-0.5">
                            {station.ipAddress || 'No IP'}
                          </div>
                          {station.hostName && (
                            <div className="text-[8px] text-muted-foreground truncate leading-none">
                              {station.hostName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <div>
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <MapPin className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                            <span className="text-[9px] truncate leading-none">{station.siteName || '-'}</span>
                            {station.siteRating !== undefined && (
                              <>
                                <Star className="h-2 w-2 text-yellow-500 flex-shrink-0" />
                                <span className="text-[8px] leading-none">{station.siteRating}</span>
                              </>
                            )}
                          </div>
                          {station.deviceType && (
                            <Badge variant="outline" className="text-[8px] h-2.5 px-1 py-0 mb-0.5">
                              {station.deviceType}
                            </Badge>
                          )}
                          {station.manufacturer && (
                            <div className="text-[8px] text-muted-foreground truncate leading-none">
                              {station.manufacturer}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <div>
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <User className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                            <span className="text-[9px] truncate leading-none">{station.username || '-'}</span>
                          </div>
                          {station.role && (
                            <div className="text-[8px] text-muted-foreground leading-none mb-0.5">{station.role}</div>
                          )}
                          <div className="flex items-center gap-0.5">
                            <Router className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                            <span className="text-[8px] truncate leading-none">{station.network || '-'}</span>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <div>
                          <div className="text-[9px] truncate leading-none mb-0.5">{station.apName || '-'}</div>
                          {station.apSerial && (
                            <div className="font-mono text-[8px] text-muted-foreground truncate leading-none mb-0.5">
                              {station.apSerial}
                            </div>
                          )}
                          <div className="flex items-center gap-0.5">
                            <Clock className="h-2 w-2 text-muted-foreground flex-shrink-0" />
                            <span className="text-[8px] leading-none">{station.lastSeen || '-'}</span>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <div>
                          {station.signalStrength !== undefined ? (
                            <div className="flex items-center gap-0.5 mb-0.5">
                              <Signal className="h-2 w-2 flex-shrink-0" />
                              <span className="text-[9px] leading-none">{station.signalStrength} dBm</span>
                            </div>
                          ) : (
                            <span className="text-[9px] leading-none">-</span>
                          )}
                          {station.rxRate && (
                            <div className="text-[8px] text-muted-foreground leading-none mb-0.5">
                              {station.rxRate}
                            </div>
                          )}
                          {station.channel && (
                            <div className="text-[8px] text-muted-foreground leading-none">
                              Ch {station.channel}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <div>
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <Download className="h-2 w-2 text-green-600 flex-shrink-0" />
                            <span className="text-[8px] leading-none">{formatBytes(station.rxBytes || station.clientBandwidthBytes || 0)}</span>
                          </div>
                          <div className="flex items-center gap-0.5 mb-0.5">
                            <Upload className="h-2 w-2 text-blue-600 flex-shrink-0" />
                            <span className="text-[8px] leading-none">{formatBytes(station.txBytes || station.outBytes || 0)}</span>
                          </div>
                          {(station.packets || station.outPackets) && (
                            <div className="text-[8px] text-muted-foreground leading-none">
                              {station.packets || station.outPackets}p
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="p-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStation(station);
                            setIsModalOpen(true);
                          }}
                          className="h-4 w-4 p-0"
                        >
                          <Eye className="h-2.5 w-2.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Panel */}
      {selectedStations.size > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Bulk Actions</CardTitle>
                <CardDescription>
                  {selectedStations.size} station{selectedStations.size !== 1 ? 's' : ''} selected
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStations(new Set())}
              >
                Clear Selection
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setActionType('delete');
                  setIsActionsModalOpen(true);
                }}
                className="flex items-center space-x-1"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('disassociate');
                  setIsActionsModalOpen(true);
                }}
                className="flex items-center space-x-1"
              >
                <UserX className="h-3 w-3" />
                <span>Disassociate</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('reauthenticate');
                  setIsActionsModalOpen(true);
                }}
                className="flex items-center space-x-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reauthenticate</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('addToGroup');
                  setIsActionsModalOpen(true);
                }}
                className="flex items-center space-x-1"
              >
                <UserPlus className="h-3 w-3" />
                <span>Add to Group</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('removeFromGroup');
                  setIsActionsModalOpen(true);
                }}
                className="flex items-center space-x-1"
              >
                <UserMinus className="h-3 w-3" />
                <span>Remove from Group</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('addToAllowList');
                  setIsActionsModalOpen(true);
                }}
                className="flex items-center space-x-1"
              >
                <ShieldCheck className="h-3 w-3" />
                <span>Add to Allow List</span>
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActionType('addToDenyList');
                  setIsActionsModalOpen(true);
                }}
                className="flex items-center space-x-1"
              >
                <ShieldX className="h-3 w-3" />
                <span>Add to Deny List</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions Confirmation Modal */}
      <Dialog open={isActionsModalOpen} onOpenChange={setIsActionsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Confirm Action</span>
            </DialogTitle>
            <DialogDescription>
              This action will affect {selectedStations.size} selected station{selectedStations.size !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {(actionType === 'addToGroup' || actionType === 'removeFromGroup') && (
              <div className="space-y-2">
                <label htmlFor="groupId" className="text-sm font-medium">Group ID:</label>
                <Input
                  id="groupId"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  placeholder="Enter group ID"
                />
              </div>
            )}
            
            {(actionType === 'addToAllowList' || actionType === 'addToDenyList') && (
              <div className="space-y-2">
                <label htmlFor="siteId" className="text-sm font-medium">Site ID:</label>
                <Input
                  id="siteId"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  placeholder="Enter site ID"
                />
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setIsActionsModalOpen(false)}
                disabled={isPerformingAction}
              >
                Cancel
              </Button>
              <Button
                onClick={() => performBulkAction(actionType)}
                disabled={isPerformingAction}
                variant={actionType === 'delete' ? 'destructive' : 'default'}
              >
                {isPerformingAction ? 'Processing...' : 'Confirm'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Client Details</span>
              {selectedStation?.status && (
                <Badge variant={getStatusBadgeVariant(selectedStation.status)}>
                  {selectedStation.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedStation?.hostName || selectedStation?.macAddress}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[600px] w-full">
            {selectedStation && (
              <Tabs 
                defaultValue="overview" 
                className="space-y-4"
                onValueChange={(value) => {
                  if (value === 'events' && selectedStation) {
                    loadStationEvents(selectedStation.macAddress);
                  }
                }}
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="connection">Connection</TabsTrigger>
                  <TabsTrigger value="technical">Technical</TabsTrigger>
                  <TabsTrigger value="events">Events</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Device Information</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">MAC Address:</span>
                          <span className="font-mono">{selectedStation.macAddress}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IP Address:</span>
                          <span className="font-mono">{selectedStation.ipAddress || 'N/A'}</span>
                        </div>
                        {selectedStation.ipv6Address && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">IPv6 Address:</span>
                            <span className="font-mono text-sm">{selectedStation.ipv6Address}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hostname:</span>
                          <span>{selectedStation.hostName || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Device Type:</span>
                          <span>{selectedStation.deviceType || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Manufacturer:</span>
                          <span>{selectedStation.manufacturer || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Username:</span>
                          <span>{selectedStation.username || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Role:</span>
                          <span>{selectedStation.role || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Network Activity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Site Name:</span>
                          <span>{selectedStation.siteName || 'N/A'}</span>
                        </div>
                        {selectedStation.siteRating !== undefined && (
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Site Rating:</span>
                            <div className="flex items-center space-x-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              <span>{selectedStation.siteRating}</span>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Seen:</span>
                          <span>{selectedStation.lastSeen || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Data Downloaded:</span>
                          <div className="flex items-center space-x-1">
                            <Download className="h-4 w-4" />
                            <span>{formatBytes(selectedStation.rxBytes || selectedStation.clientBandwidthBytes || 0)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Data Uploaded:</span>
                          <div className="flex items-center space-x-1">
                            <Upload className="h-4 w-4" />
                            <span>{formatBytes(selectedStation.txBytes || selectedStation.outBytes || 0)}</span>
                          </div>
                        </div>
                        {(selectedStation.packets || selectedStation.outPackets) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Packets:</span>
                            <span>{selectedStation.packets || selectedStation.outPackets}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Network:</span>
                          <span>{selectedStation.network || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="connection" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Access Point Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">AP Name:</span>
                          <span>{selectedStation.apName || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">AP Serial:</span>
                          <span className="font-mono">{selectedStation.apSerial || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Signal Strength:</span>
                          <div className="flex items-center space-x-1">
                            <Signal className="h-4 w-4" />
                            <span>{selectedStation.signalStrength !== undefined ? `${selectedStation.signalStrength} dBm` : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Channel:</span>
                          <span>{selectedStation.channel || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">RX Rate:</span>
                          <span>{selectedStation.rxRate || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">TX Rate:</span>
                          <span>{selectedStation.txRate || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Connection Status</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Status:</span>
                          <Badge variant={getStatusBadgeVariant(selectedStation.status || '')}>
                            {selectedStation.status || 'Unknown'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Connection Duration:</span>
                          <span>{formatDuration(selectedStation.duration || selectedStation.associationTime || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Last Seen:</span>
                          <span>{selectedStation.lastSeen || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Authentication:</span>
                          <span>{selectedStation.authMethod || selectedStation.authentication || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">VLAN ID:</span>
                          <span>{selectedStation.vlanId || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Session ID:</span>
                          <span className="font-mono text-sm">{selectedStation.sessionId || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="technical" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Traffic Statistics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Bytes Received:</span>
                          <div className="flex items-center space-x-1">
                            <Download className="h-4 w-4" />
                            <span>{formatBytes(selectedStation.rxBytes || selectedStation.clientBandwidthBytes || 0)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Bytes Transmitted:</span>
                          <div className="flex items-center space-x-1">
                            <Upload className="h-4 w-4" />
                            <span>{formatBytes(selectedStation.txBytes || selectedStation.outBytes || 0)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Packets Received:</span>
                          <span>{selectedStation.rxPackets || selectedStation.inPackets || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Packets Transmitted:</span>
                          <span>{selectedStation.txPackets || selectedStation.outPackets || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Packets:</span>
                          <span>{selectedStation.packets || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Technical Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">BSSID:</span>
                          <span className="font-mono">{selectedStation.bssid || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">SSID:</span>
                          <span>{selectedStation.ssid || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Band:</span>
                          <span>{selectedStation.band || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Protocol:</span>
                          <span>{selectedStation.protocol || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Encryption:</span>
                          <span>{selectedStation.encryption || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Radio Type:</span>
                          <span>{selectedStation.radioType || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Capabilities:</span>
                          <span>{selectedStation.capabilities || 'N/A'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="events" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Station Events</CardTitle>
                      <CardDescription>
                        Event history for {selectedStation.macAddress}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingEvents ? (
                        <div className="space-y-2">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : stationEvents.length === 0 ? (
                        <div className="text-center py-8">
                          <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Events Found</h3>
                          <p className="text-muted-foreground">
                            No events recorded for this station.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {stationEvents.map((event, index) => (
                            <div key={index} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline">
                                    {event.eventType || event.type || 'Event'}
                                  </Badge>
                                  <span className="text-sm font-medium">
                                    {event.description || event.message || 'No description'}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {event.timestamp || event.time || 'Unknown time'}
                                </span>
                              </div>
                              {event.details && (
                                <p className="text-sm text-muted-foreground">
                                  {event.details}
                                </p>
                              )}
                              {(event.severity || event.level) && (
                                <Badge 
                                  variant={
                                    (event.severity || event.level).toLowerCase() === 'error' ? 'destructive' : 
                                    (event.severity || event.level).toLowerCase() === 'warning' ? 'secondary' : 
                                    'outline'
                                  }
                                  className="mt-2"
                                >
                                  {event.severity || event.level}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}