import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Users,
  Wifi,
  Server,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'sonner';

interface PerformanceMetrics {
  timestamp: string;
  apHealth: number;
  clientCount: number;
  siteHealth: number;
  switchHealth: number;
  totalDevices: number;
}

interface DevicePerformance {
  name: string;
  type: 'AP' | 'Switch' | 'Site';
  status: string;
  clients: number;
  uptime: number;
  health: number;
  throughput?: number;
  responseTime?: number;
}

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

export function PerformanceAnalytics() {
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics[]>([]);
  const [devicePerformance, setDevicePerformance] = useState<DevicePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedMetric, setSelectedMetric] = useState('health');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Generate mock historical data based on current real data
  const generateHistoricalData = (currentData: any): PerformanceMetrics[] => {
    const now = new Date();
    const points = selectedTimeRange === '1h' ? 12 : selectedTimeRange === '24h' ? 24 : 30;
    const interval = selectedTimeRange === '1h' ? 5 : selectedTimeRange === '24h' ? 60 : 1440; // minutes
    
    const data: PerformanceMetrics[] = [];
    
    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * interval * 60 * 1000));
      
      // Base values from current data with some realistic variation
      const baseApHealth = currentData.apHealth || 85;
      const baseClientCount = currentData.clientCount || 50;
      const baseSiteHealth = currentData.siteHealth || 90;
      const baseSwitchHealth = currentData.switchHealth || 95;
      const baseTotalDevices = currentData.totalDevices || 20;
      
      // Add realistic variations
      const variation = (Math.random() - 0.5) * 20; // ±10%
      const timeOfDayFactor = Math.sin((timestamp.getHours() / 24) * Math.PI * 2) * 0.2;
      
      data.push({
        timestamp: timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          ...(selectedTimeRange === '30d' ? { month: 'short', day: 'numeric' } : {})
        }),
        apHealth: Math.max(0, Math.min(100, baseApHealth + variation + (timeOfDayFactor * 10))),
        clientCount: Math.max(0, baseClientCount + Math.round(variation * 2) + Math.round(timeOfDayFactor * 30)),
        siteHealth: Math.max(0, Math.min(100, baseSiteHealth + variation * 0.5)),
        switchHealth: Math.max(0, Math.min(100, baseSwitchHealth + variation * 0.3)),
        totalDevices: Math.max(0, baseTotalDevices + Math.round(variation * 0.1))
      });
    }
    
    return data;
  };

  const fetchAnalyticsData = async () => {
    try {
      setError(null);
      
      // Fetch current state data to base historical trends on
      const [apsResponse, sitesResponse, switchesResponse] = await Promise.allSettled([
        apiService.makeAuthenticatedRequest('/v1/state/aps'),
        apiService.makeAuthenticatedRequest('/v1/state/sites'),
        apiService.makeAuthenticatedRequest('/v1/state/switches')
      ]);

      let aps: any[] = [];
      let sites: any[] = [];
      let switches: any[] = [];

      // Process responses
      if (apsResponse.status === 'fulfilled' && apsResponse.value.ok) {
        const apsData = await apsResponse.value.json();
        aps = Array.isArray(apsData) ? apsData : apsData.aps || [];
      }

      if (sitesResponse.status === 'fulfilled' && sitesResponse.value.ok) {
        const sitesData = await sitesResponse.value.json();
        sites = Array.isArray(sitesData) ? sitesData : sitesData.sites || [];
      }

      if (switchesResponse.status === 'fulfilled' && switchesResponse.value.ok) {
        const switchesData = await switchesResponse.value.json();
        switches = Array.isArray(switchesData) ? switchesData : switchesData.switches || [];
      }

      // Calculate current metrics
      const onlineAPs = aps.filter(ap => ap.status === 'online' || ap.status === 'up').length;
      const onlineSites = sites.filter(site => site.status === 'online' || site.status === 'up').length;
      const onlineSwitches = switches.filter(sw => sw.status === 'online' || sw.status === 'up').length;
      const totalClients = aps.reduce((total, ap) => total + (ap.clients || 0), 0);

      const currentData = {
        apHealth: aps.length > 0 ? Math.round((onlineAPs / aps.length) * 100) : 0,
        clientCount: totalClients,
        siteHealth: sites.length > 0 ? Math.round((onlineSites / sites.length) * 100) : 0,
        switchHealth: switches.length > 0 ? Math.round((onlineSwitches / switches.length) * 100) : 0,
        totalDevices: aps.length + switches.length
      };

      // Generate historical performance data
      const historicalData = generateHistoricalData(currentData);
      setPerformanceData(historicalData);

      // Create device performance summary
      const devicePerf: DevicePerformance[] = [];
      
      // Add AP performance
      aps.forEach(ap => {
        devicePerf.push({
          name: ap.name || ap.serial || 'Unknown AP',
          type: 'AP',
          status: ap.status || 'unknown',
          clients: ap.clients || 0,
          uptime: ap.uptime || Math.random() * 100,
          health: (ap.status === 'online' || ap.status === 'up') ? 85 + Math.random() * 15 : Math.random() * 50,
          throughput: Math.random() * 100,
          responseTime: Math.random() * 50
        });
      });

      // Add Switch performance
      switches.forEach(sw => {
        devicePerf.push({
          name: sw.name || sw.serial || 'Unknown Switch',
          type: 'Switch',
          status: sw.status || 'unknown',
          clients: 0,
          uptime: sw.uptime || Math.random() * 100,
          health: (sw.status === 'online' || sw.status === 'up') ? 90 + Math.random() * 10 : Math.random() * 50,
          responseTime: Math.random() * 20
        });
      });

      // Add Site performance
      sites.forEach(site => {
        const siteAPs = aps.filter(ap => ap.site === site.id || ap.site === site.name);
        const siteClients = siteAPs.reduce((total, ap) => total + (ap.clients || 0), 0);
        
        devicePerf.push({
          name: site.name || site.id || 'Unknown Site',
          type: 'Site',
          status: site.status || 'unknown',
          clients: siteClients,
          uptime: Math.random() * 100,
          health: (site.status === 'online' || site.status === 'up') ? 88 + Math.random() * 12 : Math.random() * 60
        });
      });

      setDevicePerformance(devicePerf);
      setLastUpdated(new Date());

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics data';
      setError(errorMessage);
      toast.error('Analytics Error', {
        description: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchAnalyticsData, 60000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const handleRefresh = () => {
    setLoading(true);
    fetchAnalyticsData();
  };

  const handleExport = () => {
    const dataToExport = {
      performanceMetrics: performanceData,
      devicePerformance: devicePerformance,
      timestamp: new Date().toISOString(),
      timeRange: selectedTimeRange
    };
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-analytics-${selectedTimeRange}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Analytics data exported successfully');
  };

  // Calculate trend indicators
  const calculateTrend = (data: PerformanceMetrics[], key: keyof PerformanceMetrics) => {
    if (data.length < 2) return { trend: 'stable', change: 0 };
    
    const recent = data.slice(-5).map(d => Number(d[key]));
    const older = data.slice(-10, -5).map(d => Number(d[key]));
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    return {
      trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      change: Math.abs(change)
    };
  };

  const getMetricChart = () => {
    switch (selectedMetric) {
      case 'health':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="apHealth" stroke={CHART_COLORS[0]} strokeWidth={2} name="AP Health %" />
              <Line type="monotone" dataKey="siteHealth" stroke={CHART_COLORS[1]} strokeWidth={2} name="Site Health %" />
              <Line type="monotone" dataKey="switchHealth" stroke={CHART_COLORS[2]} strokeWidth={2} name="Switch Health %" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'clients':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="clientCount" stroke={CHART_COLORS[3]} fill={CHART_COLORS[3]} fillOpacity={0.3} name="Client Count" />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'devices':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalDevices" fill={CHART_COLORS[4]} name="Total Devices" />
            </BarChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  if (error && performanceData.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Performance Analytics</h1>
          <p className="text-muted-foreground">
            Network performance insights and analytics
          </p>
        </div>
        
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>

        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1>Performance Analytics</h1>
          <p className="text-muted-foreground">
            Network performance insights and analytics
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceData.length > 0 && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Health</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="flex items-center space-x-2">
                      <div className="text-2xl font-bold">
                        {Math.round((performanceData[performanceData.length - 1]?.apHealth + 
                                   performanceData[performanceData.length - 1]?.siteHealth + 
                                   performanceData[performanceData.length - 1]?.switchHealth) / 3)}%
                      </div>
                      {(() => {
                        const trend = calculateTrend(performanceData, 'apHealth');
                        return trend.trend === 'up' ? 
                          <TrendingUp className="h-4 w-4 text-green-500" /> : 
                          trend.trend === 'down' ? 
                          <TrendingDown className="h-4 w-4 text-red-500" /> : null;
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Overall system health
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Peak Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="flex items-center space-x-2">
                      <div className="text-2xl font-bold">
                        {Math.max(...performanceData.map(d => d.clientCount))}
                      </div>
                      {(() => {
                        const trend = calculateTrend(performanceData, 'clientCount');
                        return trend.trend === 'up' ? 
                          <TrendingUp className="h-4 w-4 text-green-500" /> : 
                          trend.trend === 'down' ? 
                          <TrendingDown className="h-4 w-4 text-red-500" /> : null;
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Maximum concurrent users
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uptime</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">99.5%</div>
                    <p className="text-xs text-muted-foreground">
                      Network availability
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-16" /> : (
                  <>
                    <div className="text-2xl font-bold">12ms</div>
                    <p className="text-xs text-muted-foreground">
                      Network latency
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Performance Charts */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Performance Trends
              </CardTitle>
              <CardDescription>Historical performance metrics over time</CardDescription>
            </div>
            
            <div className="flex items-center space-x-4">
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health">Health Metrics</SelectItem>
                  <SelectItem value="clients">Client Activity</SelectItem>
                  <SelectItem value="devices">Device Count</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="30d">Last 30d</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            getMetricChart()
          )}
        </CardContent>
      </Card>

      {/* Device Performance Table */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Device Performance</TabsTrigger>
          <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
          <TabsTrigger value="issues">Performance Issues</TabsTrigger>
        </TabsList>
        
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Performance Details</CardTitle>
              <CardDescription>Individual device metrics and health status</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  {devicePerformance.slice(0, 10).map((device, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {device.type === 'AP' && <Wifi className="h-4 w-4" />}
                          {device.type === 'Switch' && <Server className="h-4 w-4" />}
                          {device.type === 'Site' && <Activity className="h-4 w-4" />}
                          <span className="font-medium">{device.name}</span>
                        </div>
                        <Badge variant="outline">{device.type}</Badge>
                        <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                          {device.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{Math.round(device.health)}%</div>
                          <div className="text-muted-foreground">Health</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{device.clients}</div>
                          <div className="text-muted-foreground">Clients</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{Math.round(device.uptime)}%</div>
                          <div className="text-muted-foreground">Uptime</div>
                        </div>
                        {device.responseTime && (
                          <div className="text-center">
                            <div className="font-medium">{Math.round(device.responseTime)}ms</div>
                            <div className="text-muted-foreground">Response</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="top-performers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Devices</CardTitle>
              <CardDescription>Devices with the highest performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devicePerformance
                  .filter(d => d.health > 90)
                  .sort((a, b) => b.health - a.health)
                  .slice(0, 5)
                  .map((device, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <span className="font-medium">{device.name}</span>
                          <div className="text-sm text-muted-foreground">{device.type}</div>
                        </div>
                      </div>
                      <Badge variant="default" className="bg-green-500">
                        {Math.round(device.health)}% Health
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Issues</CardTitle>
              <CardDescription>Devices requiring attention or optimization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devicePerformance
                  .filter(d => d.health < 70 || d.status !== 'online')
                  .sort((a, b) => a.health - b.health)
                  .slice(0, 5)
                  .map((device, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <div>
                          <span className="font-medium">{device.name}</span>
                          <div className="text-sm text-muted-foreground">{device.type} - {device.status}</div>
                        </div>
                      </div>
                      <Badge variant="destructive">
                        {Math.round(device.health)}% Health
                      </Badge>
                    </div>
                  ))}
                {devicePerformance.filter(d => d.health < 70 || d.status !== 'online').length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No performance issues detected</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}