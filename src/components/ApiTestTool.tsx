import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Play, Copy, Trash2, Filter, ChevronDown, ChevronRight, Code, Download, Upload, Book, Search, RefreshCw, Settings2, Loader2, History, FileJson, FileText, ListTree, Eye, Save } from 'lucide-react';
import { apiService } from '../services/api';
import { toast } from 'sonner';

interface ApiRequest {
  id: string;
  method: string;
  endpoint: string;
  body?: string;
  timestamp: Date;
}

interface ApiResponse {
  status: number;
  statusText: string;
  body: string;
  headers: Record<string, string>;
  duration: number;
}

interface EndpointInfo {
  method: string;
  endpoint: string;
  description: string;
}

// --- Collection types and configs for dynamic defaults ---
interface CollectionItem { value: string; label: string; }
interface CollectionConfig {
  key: string;            // unique key for state
  displayName: string;    // shown in UI dropdown label
  endpoint: string;       // API endpoint to fetch
  valueField: string;     // field to use as value
  labelField: string;     // field to use as display label
  placeholders: string[]; // placeholders this collection resolves
  fallback?: string;      // static default if fetch fails
}

const COLLECTION_CONFIGS: CollectionConfig[] = [
  {
    key: 'sites',
    displayName: 'Site',
    endpoint: '/v3/sites',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{siteId}', '{siteid}'],
  },
  {
    key: 'aps',
    displayName: 'Access Point',
    endpoint: '/v1/aps',
    valueField: 'serialNumber',
    labelField: 'displayName',
    placeholders: ['{apSerialNumber}', '{apserialnum}'],
    fallback: 'CV012408S-C0102',
  },
  {
    key: 'stations',
    displayName: 'Client',
    endpoint: '/v1/stations',
    valueField: 'macAddress',
    labelField: 'hostName',
    placeholders: ['{macaddress}', '{macAddress}', '{stationId}'],
    fallback: '44:61:32:25:F8:DD',
  },
  {
    key: 'services',
    displayName: 'Service',
    endpoint: '/v1/services',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{serviceId}', '{serviceid}'],
    fallback: 'Skynet',
  },
  {
    key: 'roles',
    displayName: 'Role',
    endpoint: '/v3/roles',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{roleId}', '{roleid}'],
    fallback: 'Skynet_Admin',
  },
  {
    key: 'profiles',
    displayName: 'Profile',
    endpoint: '/v3/profiles',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{profileId}'],
  },
  {
    key: 'switches',
    displayName: 'Switch',
    endpoint: '/v1/switches',
    valueField: 'serialNumber',
    labelField: 'displayName',
    placeholders: ['{serialNumber}', '{switchSerialNumber}'],
  },
  {
    key: 'adsp',
    displayName: 'Air Defense',
    endpoint: '/v3/adsp',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{adspId}'],
  },
  {
    key: 'analytics',
    displayName: 'Analytics',
    endpoint: '/v3/analytics',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{analyticsProfileId}'],
  },
  {
    key: 'cos',
    displayName: 'Class of Service',
    endpoint: '/v1/cos',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{cosId}'],
  },
  {
    key: 'ratelimiters',
    displayName: 'Rate Limiter',
    endpoint: '/v1/ratelimiters',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{rateLimiterId}'],
  },
  {
    key: 'iotprofile',
    displayName: 'IoT Profile',
    endpoint: '/v3/iotprofile',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{iotprofileId}'],
  },
  {
    key: 'rtlsprofile',
    displayName: 'RTLS Profile',
    endpoint: '/v1/rtlsprofile',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{rtlsprofileId}'],
  },
  {
    key: 'positioning',
    displayName: 'Positioning',
    endpoint: '/v3/positioning',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{positioningProfileId}'],
  },
  {
    key: 'xlocation',
    displayName: 'XLocation',
    endpoint: '/v3/xlocation',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{xlocationId}'],
  },
  {
    key: 'meshpoints',
    displayName: 'Meshpoint',
    endpoint: '/v3/meshpoints',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{meshpointId}'],
  },
  {
    key: 'topologies',
    displayName: 'Topology',
    endpoint: '/v1/topologies',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{topologyId}'],
  },
  {
    key: 'rfmgmt',
    displayName: 'RF Management',
    endpoint: '/v3/rfmgmt',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{rfmgmtId}'],
  },
  {
    key: 'eguest',
    displayName: 'EGuest',
    endpoint: '/v1/eguest',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{eguestId}'],
  },
  {
    key: 'aaapolicy',
    displayName: 'AAA Policy',
    endpoint: '/v1/aaapolicy',
    valueField: 'id',
    labelField: 'name',
    placeholders: [],
  },
  {
    key: 'reportTemplates',
    displayName: 'Report Template',
    endpoint: '/v1/reports/templates',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{templateId}'],
  },
  {
    key: 'scheduledReports',
    displayName: 'Scheduled Report',
    endpoint: '/v1/reports/scheduled',
    valueField: 'id',
    labelField: 'name',
    placeholders: ['{reportId}'],
  },
  {
    key: 'switchportprofile',
    displayName: 'Switch Port Profile',
    endpoint: '/v3/switchportprofile',
    valueField: 'id',
    labelField: 'name',
    placeholders: [],
  },
];

// Static defaults for non-collection placeholders
const staticPlaceholders: Record<string, string> = {
  '{portNumber}': '1',
  '{portId}': '1',
  '{slotNumber}': '0',
  '{userId}': 'admin',
  '{duration}': '24h',
  '{consoleAction}': 'enable',
  '{hwType}': 'AP3000',
  '{configurationMode}': 'managed',
};

// Dropdown options for static (non-collection) parameters
const STATIC_PARAM_OPTIONS: Record<string, { label: string; options: { value: string; label: string }[] }> = {
  portNumber: {
    label: 'Port Number',
    options: Array.from({ length: 48 }, (_, i) => ({ value: String(i + 1), label: `Port ${i + 1}` })),
  },
  portId: {
    label: 'Port ID',
    options: Array.from({ length: 48 }, (_, i) => ({ value: String(i + 1), label: `Port ${i + 1}` })),
  },
  slotNumber: {
    label: 'Slot Number',
    options: [
      { value: '0', label: 'Slot 0' },
      { value: '1', label: 'Slot 1' },
      { value: '2', label: 'Slot 2' },
      { value: '3', label: 'Slot 3' },
    ],
  },
  consoleAction: {
    label: 'Console Action',
    options: [
      { value: 'enable', label: 'Enable' },
      { value: 'disable', label: 'Disable' },
    ],
  },
  duration: {
    label: 'Duration',
    options: [
      { value: '1h', label: '1 Hour' },
      { value: '6h', label: '6 Hours' },
      { value: '24h', label: '24 Hours' },
      { value: '7d', label: '7 Days' },
      { value: '30d', label: '30 Days' },
    ],
  },
  hwType: {
    label: 'Hardware Type',
    options: [
      { value: 'AP3000', label: 'AP3000' },
      { value: 'AP4000', label: 'AP4000' },
      { value: 'AP1201', label: 'AP1201' },
      { value: 'AP1201H', label: 'AP1201H' },
      { value: 'AP1231', label: 'AP1231' },
      { value: 'AP1301', label: 'AP1301' },
      { value: 'AP1301H', label: 'AP1301H' },
      { value: 'AP1311', label: 'AP1311' },
      { value: 'AP1331', label: 'AP1331' },
      { value: 'AP1351', label: 'AP1351' },
      { value: 'AP1431', label: 'AP1431' },
    ],
  },
  configurationMode: {
    label: 'Config Mode',
    options: [
      { value: 'managed', label: 'Managed' },
      { value: 'autonomous', label: 'Autonomous' },
    ],
  },
  userId: {
    label: 'User ID',
    options: [
      { value: 'admin', label: 'admin' },
    ],
  },
};

// Context-aware param → collection resolution (handles shared placeholder names)
function resolveParamConfig(template: string, paramName: string): CollectionConfig | undefined {
  // Override for {profileId} when used in switchportprofile context
  if (paramName === 'profileId' && template.includes('switchportprofile')) {
    return COLLECTION_CONFIGS.find(c => c.key === 'switchportprofile');
  }
  // Generic {id} → resolve by path context
  if (paramName === 'id') {
    if (template.includes('/aaapolicy/')) return COLLECTION_CONFIGS.find(c => c.key === 'aaapolicy');
    return undefined;
  }
  const placeholder = `{${paramName}}`;
  return COLLECTION_CONFIGS.find(c => c.placeholders.includes(placeholder));
}

function extractField(item: Record<string, unknown>, field: string): string {
  if (item[field] != null && String(item[field]).length > 0) return String(item[field]);
  if (item.id != null) return String(item.id);
  if (item.name != null) return String(item.name);
  return String(item);
}

// Move categories outside component to prevent recreating on each render
const endpointCategories: Record<string, EndpointInfo[]> = {
  'Authentication & Authorization': [
    { method: 'POST', endpoint: '/v1/oauth2/token', description: 'Get OAuth2 access token' },
    { method: 'POST', endpoint: '/v1/oauth2/refreshToken', description: 'Refresh OAuth2 token' },
    { method: 'DELETE', endpoint: '/v1/oauth2/token/{token}', description: 'Revoke OAuth2 token' },
    { method: 'POST', endpoint: '/v1/oauth2/introspecttoken', description: 'Introspect OAuth2 token' },
    { method: 'GET', endpoint: '/v1/administrators', description: 'Get administrators' },
    { method: 'POST', endpoint: '/v1/administrators', description: 'Create administrator' },
    { method: 'PUT', endpoint: '/v1/administrators/adminpassword', description: 'Update admin password' },
    { method: 'GET', endpoint: '/v1/administrators/{userId}', description: 'Get administrator by ID' },
    { method: 'PUT', endpoint: '/v1/administrators/{userId}', description: 'Update administrator' },
    { method: 'DELETE', endpoint: '/v1/administrators/{userId}', description: 'Delete administrator' },
    { method: 'PUT', endpoint: '/v1/administratorsTimeout/{userId}', description: 'Set administrator timeout' },
    { method: 'GET', endpoint: '/v1/appkeys', description: 'Get application keys' },
    { method: 'POST', endpoint: '/v1/appkeys', description: 'Create application key' },
    { method: 'GET', endpoint: '/v1/appkeys/{appKey}', description: 'Get application key' },
    { method: 'DELETE', endpoint: '/v1/appkeys/{appKey}', description: 'Delete application key' },
  ],
  
  'Access Control': [
    { method: 'GET', endpoint: '/v1/accesscontrol', description: 'Get access control lists' },
    { method: 'PUT', endpoint: '/v1/accesscontrol', description: 'Update access control list' },
    { method: 'POST', endpoint: '/v1/accesscontrol', description: 'Create access control list' },
    { method: 'DELETE', endpoint: '/v1/accesscontrol', description: 'Delete access control list' },
  ],

  'Access Points': [
    { method: 'GET', endpoint: '/v1/aps', description: 'Get access points' },
    { method: 'GET', endpoint: '/v1/aps/query', description: 'Query access points' },
    { method: 'GET', endpoint: '/v1/aps/query/visualize', description: 'Get AP query visualization' },
    { method: 'GET', endpoint: '/v1/aps/query/columns', description: 'Get AP query columns' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}/bssid0', description: 'Get AP primary BSSID services' },
    { method: 'GET', endpoint: '/v1/aps/adoptionrules', description: 'Get AP adoption rules' },
    { method: 'PUT', endpoint: '/v1/aps/adoptionrules', description: 'Update AP adoption rules' },
    { method: 'GET', endpoint: '/v1/aps/apbalance', description: 'Get AP balance settings' },
    { method: 'PUT', endpoint: '/v1/aps/apbalance', description: 'Update AP balance settings' },
    { method: 'POST', endpoint: '/v1/aps/create', description: 'Create access point' },
    { method: 'GET', endpoint: '/v1/aps/default', description: 'Get default AP configuration' },
    { method: 'GET', endpoint: '/v1/aps/displaynames', description: 'Get AP display names' },
    { method: 'GET', endpoint: '/v1/aps/hardwaretypes', description: 'Get AP hardware types' },
    { method: 'GET', endpoint: '/v1/aps/platforms', description: 'Get AP platforms' },
    { method: 'DELETE', endpoint: '/v1/aps/list', description: 'Delete AP list' },
    { method: 'PUT', endpoint: '/v1/aps/multiconfig', description: 'Multi-configure APs' },
    { method: 'PUT', endpoint: '/v1/aps/reboot', description: 'Reboot APs' },
    { method: 'PUT', endpoint: '/v1/aps/releasetocloud', description: 'Release APs to cloud' },
    { method: 'PUT', endpoint: '/v1/aps/assign', description: 'Assign APs' },
    { method: 'POST', endpoint: '/v1/aps/clone', description: 'Clone AP configuration' },
    { method: 'GET', endpoint: '/v1/aps/registration', description: 'Get AP registration' },
    { method: 'PUT', endpoint: '/v1/aps/registration', description: 'Update AP registration' },
    { method: 'PUT', endpoint: '/v1/aps/setRuState', description: 'Set RU state for APs' },
    { method: 'PUT', endpoint: '/v1/aps/swupgrade', description: 'Software upgrade APs' },
    { method: 'PUT', endpoint: '/v1/aps/swversion', description: 'Set AP software version' },
    { method: 'PUT', endpoint: '/v1/aps/upgrade', description: 'Upgrade APs' },
    { method: 'GET', endpoint: '/v1/aps/upgradeimagelist', description: 'Get upgrade image list' },
    { method: 'PUT', endpoint: '/v1/aps/upgradeschedule', description: 'Schedule AP upgrade' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}', description: 'Get specific AP' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}', description: 'Update specific AP' },
    { method: 'DELETE', endpoint: '/v1/aps/{apSerialNumber}', description: 'Delete specific AP' },
    { method: 'GET', endpoint: '/v1/aps/antenna/{apSerialNumber}', description: 'Get AP antenna info' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/copytodefault', description: 'Copy AP to default' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/logs', description: 'Get AP logs' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/realcapture', description: 'Real capture on AP' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/reboot', description: 'Reboot specific AP' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/locate', description: 'Locate AP' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/reset', description: 'Reset AP' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/setRuState', description: 'Set AP RU state' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}/traceurls', description: 'Get AP trace URLs' },
    { method: 'PUT', endpoint: '/v1/aps/{apSerialNumber}/upgrade', description: 'Upgrade specific AP' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}/stations', description: 'Get AP stations' },
    { method: 'GET', endpoint: '/v1/ap/environment/{apSerialNumber}', description: 'Get AP environment' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}/location', description: 'Get AP location' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}/lldp', description: 'Get AP LLDP info' },
    { method: 'GET', endpoint: '/v1/aps/ifstats/{apSerialNumber}', description: 'Get AP interface stats' },
    { method: 'GET', endpoint: '/v1/aps/ifstats', description: 'Get all AP interface stats' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}/report', description: 'Get AP report' },
    { method: 'GET', endpoint: '/v1/aps/downloadtrace/{filename}', description: 'Download AP trace file' },
  ],

  'Certificate Management': [
    { method: 'POST', endpoint: '/v1/aps/cert/signrequest', description: 'Sign AP certificate request' },
    { method: 'POST', endpoint: '/v1/aps/cert/apply', description: 'Apply AP certificate' },
    { method: 'PUT', endpoint: '/v1/aps/cert/reset', description: 'Reset AP certificate' },
    { method: 'GET', endpoint: '/v1/aps/{apSerialNumber}/cert', description: 'Get AP certificate' },
  ],

  'Sites & Site Management': [
    { method: 'GET', endpoint: '/v3/sites', description: 'Get sites' },
    { method: 'POST', endpoint: '/v3/sites', description: 'Create site' },
    { method: 'GET', endpoint: '/v3/sites/countrylist', description: 'Get country list' },
    { method: 'GET', endpoint: '/v3/sites/default', description: 'Get default site' },
    { method: 'GET', endpoint: '/v3/sites/nametoidmap', description: 'Get site name to ID map' },
    { method: 'GET', endpoint: '/v3/sites/{siteId}', description: 'Get specific site' },
    { method: 'PUT', endpoint: '/v3/sites/{siteId}', description: 'Update site' },
    { method: 'DELETE', endpoint: '/v3/sites/{siteId}', description: 'Delete site' },
    { method: 'POST', endpoint: '/v3/sites/clone/{siteId}', description: 'Clone site' },
    { method: 'GET', endpoint: '/v3/sites/{siteid}/stations', description: 'Get site stations' },
    { method: 'GET', endpoint: '/v1/sites/{siteId}/report', description: 'Get site report by site ID' },
    { method: 'GET', endpoint: '/v3/sites/report', description: 'Get site report' },
    { method: 'GET', endpoint: '/v3/sites/report/flex', description: 'Get historical data' },
    { method: 'GET', endpoint: '/v3/sites/report/impact', description: 'Get impact reports for all sites' },
    { method: 'GET', endpoint: '/v3/sites/report/location/floor/{floorId}', description: 'Get station locations on floor' },
    { method: 'GET', endpoint: '/v3/sites/report/venue', description: 'Get report for all sites in venue' },
    { method: 'GET', endpoint: '/v3/sites/{siteId}/report/impact', description: 'Get impact reports for site' },
    { method: 'GET', endpoint: '/v3/sites/{siteId}/report/venue', description: 'Get site report in venue' },
  ],

  'Stations & Clients': [
    { method: 'GET', endpoint: '/v1/stations', description: 'Get stations' },
    { method: 'POST', endpoint: '/v1/stations/disassociate', description: 'Disassociate stations' },
    { method: 'GET', endpoint: '/v1/stations/{macaddress}', description: 'Get specific station' },
    { method: 'GET', endpoint: '/v1/stations/query', description: 'Query stations' },
    { method: 'GET', endpoint: '/v1/stations/query/visualize', description: 'Get station query visualization' },
    { method: 'GET', endpoint: '/v1/stations/query/columns', description: 'Get station query columns' },
    { method: 'GET', endpoint: '/v1/stations/{stationId}/location', description: 'Get station location' },
    { method: 'GET', endpoint: '/v1/stations/events/{macaddress}', description: 'Get station events' },
    { method: 'GET', endpoint: '/v1/stations/{stationId}/report', description: 'Get station report by ID' },
  ],

  'Services & Roles': [
    { method: 'GET', endpoint: '/v1/services', description: 'Get services' },
    { method: 'POST', endpoint: '/v1/services', description: 'Create service' },
    { method: 'GET', endpoint: '/v1/services/default', description: 'Get default service' },
    { method: 'GET', endpoint: '/v1/services/nametoidmap', description: 'Get service name map' },
    { method: 'GET', endpoint: '/v1/services/{serviceId}', description: 'Get specific service' },
    { method: 'PUT', endpoint: '/v1/services/{serviceId}', description: 'Update service' },
    { method: 'DELETE', endpoint: '/v1/services/{serviceId}', description: 'Delete service' },
    { method: 'GET', endpoint: '/v1/services/{serviceId}/deviceids', description: 'Get service device IDs' },
    { method: 'GET', endpoint: '/v1/services/{serviceId}/siteids', description: 'Get service site IDs' },
    { method: 'GET', endpoint: '/v1/services/{serviceId}/stations', description: 'Get service stations' },
    { method: 'GET', endpoint: '/v1/services/{serviceid}/bssid0', description: 'Get service BSSID0' },
    { method: 'GET', endpoint: '/v3/roles', description: 'Get roles (v3)' },
    { method: 'POST', endpoint: '/v3/roles', description: 'Create role (v3)' },
    { method: 'GET', endpoint: '/v3/roles/default', description: 'Get default role (v3)' },
    { method: 'GET', endpoint: '/v3/roles/nametoidmap', description: 'Get role name map (v3)' },
    { method: 'GET', endpoint: '/v3/roles/{roleId}', description: 'Get specific role (v3)' },
    { method: 'PUT', endpoint: '/v3/roles/{roleId}', description: 'Update role (v3)' },
    { method: 'POST', endpoint: '/v3/roles/{roleId}', description: 'Create role with service ID (v3)' },
    { method: 'DELETE', endpoint: '/v3/roles/{roleId}', description: 'Delete role (v3)' },
    { method: 'GET', endpoint: '/v3/roles/{roleId}/rulestats', description: 'Get role rule stats (v3)' },
    { method: 'GET', endpoint: '/v1/roles/{roleid}/stations', description: 'Get role stations' },
    { method: 'GET', endpoint: '/v1/roles/{roleId}/report', description: 'Get role report by ID' },
    { method: 'GET', endpoint: '/v1/services/{serviceId}/report', description: 'Get service report' },
  ],

  'Network Profiles & Policies': [
    { method: 'GET', endpoint: '/v3/profiles', description: 'Get network profiles' },
    { method: 'POST', endpoint: '/v3/profiles', description: 'Create network profile' },
    { method: 'GET', endpoint: '/v3/profiles/nametoidmap', description: 'Get profile name to ID map' },
    { method: 'GET', endpoint: '/v3/profiles/{profileId}', description: 'Get specific profile' },
    { method: 'PUT', endpoint: '/v3/profiles/{profileId}', description: 'Update profile' },
    { method: 'DELETE', endpoint: '/v3/profiles/{profileId}', description: 'Delete profile' },
    { method: 'GET', endpoint: '/v3/profiles/{profileId}/channels', description: 'Get profile channels' },
    { method: 'GET', endpoint: '/v3/profiles/{profileId}/bssid0', description: 'Get profile BSSID0' },
    { method: 'GET', endpoint: '/v3/switchportprofile', description: 'Get switch port profiles' },
    { method: 'POST', endpoint: '/v3/switchportprofile', description: 'Create switch port profile' },
    { method: 'GET', endpoint: '/v3/switchportprofile/default', description: 'Get default switch port profile' },
    { method: 'GET', endpoint: '/v3/switchportprofile/nametoidmap', description: 'Get switch port profile name map' },
    { method: 'GET', endpoint: '/v3/switchportprofile/{profileId}', description: 'Get switch port profile' },
    { method: 'PUT', endpoint: '/v3/switchportprofile/{profileId}', description: 'Update switch port profile' },
    { method: 'DELETE', endpoint: '/v3/switchportprofile/{profileId}', description: 'Delete switch port profile' },
  ],

  'RF Management & Radio': [
    { method: 'GET', endpoint: '/v1/radios/channels', description: 'Get radio channels' },
    { method: 'GET', endpoint: '/v1/radios/modes', description: 'Get radio modes' },
    { method: 'GET', endpoint: '/v3/radios/smartrfchannels', description: 'Get Smart RF channels' },
    { method: 'GET', endpoint: '/v3/rfmgmt', description: 'Get RF management profiles' },
    { method: 'POST', endpoint: '/v3/rfmgmt', description: 'Create RF management profile' },
    { method: 'GET', endpoint: '/v3/rfmgmt/default', description: 'Get default RF management' },
    { method: 'GET', endpoint: '/v3/rfmgmt/nametoidmap', description: 'Get RF management name map' },
    { method: 'GET', endpoint: '/v3/rfmgmt/{rfmgmtId}', description: 'Get RF management profile' },
    { method: 'PUT', endpoint: '/v3/rfmgmt/{rfmgmtId}', description: 'Update RF management profile' },
    { method: 'DELETE', endpoint: '/v3/rfmgmt/{rfmgmtId}', description: 'Delete RF management profile' },
  ],

  'Switching & Ports': [
    { method: 'GET', endpoint: '/v1/switches', description: 'Get switches' },
    { method: 'GET', endpoint: '/v1/switches/displaynames', description: 'Get switch display names' },
    { method: 'DELETE', endpoint: '/v1/switches/list', description: 'Delete switch list' },
    { method: 'PUT', endpoint: '/v1/switches/reboot', description: 'Reboot switches' },
    { method: 'PUT', endpoint: '/v1/switches/assign', description: 'Assign switches' },
    { method: 'GET', endpoint: '/v1/switches/{serialNumber}', description: 'Get specific switch' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}', description: 'Update switch' },
    { method: 'DELETE', endpoint: '/v1/switches/{serialNumber}', description: 'Delete switch' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/logs', description: 'Get switch logs' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/reboot', description: 'Reboot specific switch' },
    { method: 'POST', endpoint: '/v1/switches/clone', description: 'Clone switch configuration' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/reset', description: 'Reset switch' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/console/{consoleAction}', description: 'Switch console action' },
    { method: 'GET', endpoint: '/v1/switches/{serialNumber}/traceurls', description: 'Get switch trace URLs' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/upgrade', description: 'Upgrade switch' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/ports/{portNumber}', description: 'Update switch port' },
    { method: 'GET', endpoint: '/v1/switches/{serialNumber}/slots/{slotNumber}/ports/{portNumber}', description: 'Get switch port' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/slots/{slotNumber}/ports/{portNumber}', description: 'Update switch slot port' },
    { method: 'GET', endpoint: '/v1/switches/{serialNumber}/clibackups', description: 'Get CLI backups' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/configurationmode/{configurationMode}', description: 'Set configuration mode' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/cliconfigs/backup', description: 'Backup CLI config' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/cliconfigs/restore/{name}', description: 'Restore CLI config' },
    { method: 'PUT', endpoint: '/v1/switches/{serialNumber}/login', description: 'Switch login' },
    { method: 'GET', endpoint: '/v1/switches/{serialNumber}/report', description: 'Get switch report by serial number' },
    { method: 'GET', endpoint: '/v1/switches/{serialNumber}/ports/{portId}/report', description: 'Get port report by switch' },
  ],

  'System Configuration': [
    { method: 'GET', endpoint: '/v1/globalsettings', description: 'Get global settings' },
    { method: 'PUT', endpoint: '/v1/globalsettings', description: 'Update global settings' },
    { method: 'GET', endpoint: '/v1/nsightconfig', description: 'Get nSight configuration' },
    { method: 'PUT', endpoint: '/v1/nsightconfig', description: 'Update nSight configuration' },
    { method: 'GET', endpoint: '/v1/snmp', description: 'Get SNMP settings' },
    { method: 'GET', endpoint: '/v1/snmp/default', description: 'Get default SNMP settings' },
    { method: 'GET', endpoint: '/v1/auditlogs', description: 'Get audit logs' },
    { method: 'GET', endpoint: '/v1/notifications', description: 'Get notifications' },
    { method: 'GET', endpoint: '/v1/notifications/regional', description: 'Get regional notifications' },
    { method: 'GET', endpoint: '/v1/workflow', description: 'Get workflow' },
    { method: 'GET', endpoint: '/v1/devices/adoptionrules', description: 'Get device adoption rules' },
    { method: 'PUT', endpoint: '/v1/devices/adoptionrules', description: 'Update device adoption rules' },
    { method: 'GET', endpoint: '/v1/bestpractices/evaluate', description: 'Evaluate best practices' },
    { method: 'PUT', endpoint: '/v1/bestpractices/{id}/accept', description: 'Accept best practice' },
  ],

  'System State & Monitoring': [
    { method: 'GET', endpoint: '/v1/state/aps', description: 'Get APs state' },
    { method: 'GET', endpoint: '/v1/state/entityDistribution', description: 'Get entity distribution' },
    { method: 'GET', endpoint: '/v1/state/sites', description: 'Get sites state' },
    { method: 'GET', endpoint: '/v1/state/switches', description: 'Get switches state' },
    { method: 'GET', endpoint: '/v1/state/aps/{apSerialNumber}', description: 'Get AP state' },
    { method: 'GET', endpoint: '/v1/state/sites/{siteId}', description: 'Get site state' },
    { method: 'GET', endpoint: '/v1/state/switches/{switchSerialNumber}', description: 'Get switch state' },
    { method: 'GET', endpoint: '/v1/state/sites/{siteId}/aps', description: 'Get site APs state' },
  ],

  'Reports & Analytics': [
    { method: 'GET', endpoint: '/v1/reports/templates', description: 'Get report templates' },
    { method: 'POST', endpoint: '/v1/reports/templates', description: 'Create report template' },
    { method: 'GET', endpoint: '/v1/reports/templates/{templateId}', description: 'Get report template' },
    { method: 'PUT', endpoint: '/v1/reports/templates/{templateId}', description: 'Update report template' },
    { method: 'DELETE', endpoint: '/v1/reports/templates/{templateId}', description: 'Delete report template' },
    { method: 'GET', endpoint: '/v1/reports/templates/default', description: 'Get default report template' },
    { method: 'GET', endpoint: '/v1/reports/templates/nametoidmap', description: 'Get report template name map' },
    { method: 'GET', endpoint: '/v1/reports/scheduled', description: 'Get scheduled reports' },
    { method: 'POST', endpoint: '/v1/reports/scheduled', description: 'Create scheduled report' },
    { method: 'GET', endpoint: '/v1/reports/scheduled/{reportId}', description: 'Get scheduled report' },
    { method: 'PUT', endpoint: '/v1/reports/scheduled/{reportId}', description: 'Update scheduled report' },
    { method: 'DELETE', endpoint: '/v1/reports/scheduled/{reportId}', description: 'Delete scheduled report' },
    { method: 'GET', endpoint: '/v1/reports/scheduled/default', description: 'Get default scheduled report' },
    { method: 'GET', endpoint: '/v1/reports/scheduled/nametoidmap', description: 'Get scheduled report name map' },
    { method: 'GET', endpoint: '/v1/reports/generated', description: 'Get generated reports' },
    { method: 'GET', endpoint: '/v1/reports/generated/{filename}', description: 'Get generated report file' },
    { method: 'DELETE', endpoint: '/v1/reports/generated/{filename}', description: 'Delete generated report' },
    { method: 'PUT', endpoint: '/v1/reports/generated/filelist', description: 'Update report file list' },
    { method: 'GET', endpoint: '/v1/reports/widgets', description: 'Get report widgets' },
    { method: 'GET', endpoint: '/v1/report/sites', description: 'Get sites report' },
    { method: 'GET', endpoint: '/v1/report/aps/{apSerialNumber}', description: 'Get AP report' },
    { method: 'GET', endpoint: '/v1/report/aps/{apSerialNumber}/smartrf', description: 'Get AP SmartRF report' },
    { method: 'GET', endpoint: '/v1/report/flex/{duration}', description: 'Get flex report' },
    { method: 'GET', endpoint: '/v1/report/ports/{portId}', description: 'Get port report' },
    { method: 'GET', endpoint: '/v1/report/roles/{roleId}', description: 'Get role report' },
    { method: 'GET', endpoint: '/v1/report/services/{serviceId}', description: 'Get service report' },
    { method: 'GET', endpoint: '/v1/report/sites/{siteId}', description: 'Get site report' },
    { method: 'GET', endpoint: '/v1/report/stations/{stationId}', description: 'Get station report' },
    { method: 'GET', endpoint: '/v1/report/switches/{switchSerialNumber}', description: 'Get switch report' },
    { method: 'GET', endpoint: '/v1/report/location/aps/{apSerialNumber}', description: 'Get AP location report' },
    { method: 'GET', endpoint: '/v1/report/location/floor/{floorId}', description: 'Get floor location report' },
    { method: 'GET', endpoint: '/v1/report/location/stations/{stationId}', description: 'Get station location report' },
    { method: 'GET', endpoint: '/v1/report/sites/{siteId}/smartrf', description: 'Get site Smart RF report' },
    { method: 'GET', endpoint: '/v2/report/upgrade/devices', description: 'Get device upgrade report' },
  ],

  'Air Defense Security': [
    { method: 'GET', endpoint: '/v3/adsp', description: 'Get Air Defense profiles (v3)' },
    { method: 'POST', endpoint: '/v3/adsp', description: 'Create Air Defense profile (v3)' },
    { method: 'GET', endpoint: '/v3/adsp/default', description: 'Get default Air Defense profile (v3)' },
    { method: 'GET', endpoint: '/v3/adsp/nametoidmap', description: 'Get Air Defense profile name map (v3)' },
    { method: 'GET', endpoint: '/v3/adsp/{adspId}', description: 'Get Air Defense profile by ID (v3)' },
    { method: 'PUT', endpoint: '/v3/adsp/{adspId}', description: 'Update Air Defense profile (v3)' },
    { method: 'DELETE', endpoint: '/v3/adsp/{adspId}', description: 'Delete Air Defense profile (v3)' },
    { method: 'GET', endpoint: '/v4/adsp', description: 'Get Air Defense profiles (v4)' },
    { method: 'POST', endpoint: '/v4/adsp', description: 'Create Air Defense profile (v4)' },
    { method: 'GET', endpoint: '/v4/adsp/default', description: 'Get default Air Defense profile (v4)' },
    { method: 'GET', endpoint: '/v4/adsp/nametoidmap', description: 'Get Air Defense profile name map (v4)' },
    { method: 'GET', endpoint: '/v4/adsp/{adspId}', description: 'Get Air Defense profile by ID (v4)' },
    { method: 'PUT', endpoint: '/v4/adsp/{adspId}', description: 'Update Air Defense profile (v4)' },
    { method: 'DELETE', endpoint: '/v4/adsp/{adspId}', description: 'Delete Air Defense profile (v4)' },
  ],

  'Analytics & Performance': [
    { method: 'GET', endpoint: '/v3/analytics', description: 'Get analytics profiles' },
    { method: 'POST', endpoint: '/v3/analytics', description: 'Create analytics profile' },
    { method: 'GET', endpoint: '/v3/analytics/default', description: 'Get default analytics profile' },
    { method: 'GET', endpoint: '/v3/analytics/nametoidmap', description: 'Get analytics profile name map' },
    { method: 'GET', endpoint: '/v3/analytics/{analyticsProfileId}', description: 'Get analytics profile by ID' },
    { method: 'PUT', endpoint: '/v3/analytics/{analyticsProfileId}', description: 'Update analytics profile' },
    { method: 'DELETE', endpoint: '/v3/analytics/{analyticsProfileId}', description: 'Delete analytics profile' },
  ],

  'Quality of Service': [
    { method: 'GET', endpoint: '/v1/cos', description: 'Get Class of Service profiles' },
    { method: 'POST', endpoint: '/v1/cos', description: 'Create Class of Service profile' },
    { method: 'GET', endpoint: '/v1/cos/default', description: 'Get default Class of Service' },
    { method: 'GET', endpoint: '/v1/cos/nametoidmap', description: 'Get CoS name to ID map' },
    { method: 'GET', endpoint: '/v1/cos/{cosId}', description: 'Get Class of Service by ID' },
    { method: 'PUT', endpoint: '/v1/cos/{cosId}', description: 'Update Class of Service' },
    { method: 'DELETE', endpoint: '/v1/cos/{cosId}', description: 'Delete Class of Service' },
    { method: 'GET', endpoint: '/v1/ratelimiters', description: 'Get rate limiters' },
    { method: 'POST', endpoint: '/v1/ratelimiters', description: 'Create rate limiter' },
    { method: 'GET', endpoint: '/v1/ratelimiters/default', description: 'Get default rate limiter' },
    { method: 'GET', endpoint: '/v1/ratelimiters/nametoidmap', description: 'Get rate limiter name map' },
    { method: 'GET', endpoint: '/v1/ratelimiters/{rateLimiterId}', description: 'Get rate limiter by ID' },
    { method: 'PUT', endpoint: '/v1/ratelimiters/{rateLimiterId}', description: 'Update rate limiter' },
    { method: 'DELETE', endpoint: '/v1/ratelimiters/{rateLimiterId}', description: 'Delete rate limiter' },
  ],

  'Device Management': [
    { method: 'GET', endpoint: '/v1/deviceimages/{hwType}', description: 'Get device images by hardware type' },
    { method: 'GET', endpoint: '/v1/dpisignatures', description: 'Get DPI signatures' },
    { method: 'PUT', endpoint: '/v1/dpisignatures', description: 'Update DPI signatures' },
    { method: 'GET', endpoint: '/v1/dpisignatures/custom', description: 'Get custom DPI signatures' },
  ],

  'IoT & Location Services': [
    { method: 'GET', endpoint: '/v3/iotprofile', description: 'Get IoT profiles' },
    { method: 'POST', endpoint: '/v3/iotprofile', description: 'Create IoT profile' },
    { method: 'GET', endpoint: '/v3/iotprofile/default', description: 'Get default IoT profile' },
    { method: 'GET', endpoint: '/v3/iotprofile/nametoidmap', description: 'Get IoT profile name map' },
    { method: 'GET', endpoint: '/v3/iotprofile/{iotprofileId}', description: 'Get IoT profile by ID' },
    { method: 'PUT', endpoint: '/v3/iotprofile/{iotprofileId}', description: 'Update IoT profile' },
    { method: 'DELETE', endpoint: '/v3/iotprofile/{iotprofileId}', description: 'Delete IoT profile' },
    { method: 'GET', endpoint: '/v1/rtlsprofile', description: 'Get RTLS profiles' },
    { method: 'POST', endpoint: '/v1/rtlsprofile', description: 'Create RTLS profile' },
    { method: 'GET', endpoint: '/v1/rtlsprofile/default', description: 'Get default RTLS profile' },
    { method: 'GET', endpoint: '/v1/rtlsprofile/nametoidmap', description: 'Get RTLS profile name map' },
    { method: 'GET', endpoint: '/v1/rtlsprofile/{rtlsprofileId}', description: 'Get RTLS profile by ID' },
    { method: 'PUT', endpoint: '/v1/rtlsprofile/{rtlsprofileId}', description: 'Update RTLS profile' },
    { method: 'DELETE', endpoint: '/v1/rtlsprofile/{rtlsprofileId}', description: 'Delete RTLS profile' },
    { method: 'GET', endpoint: '/v3/positioning', description: 'Get positioning profiles' },
    { method: 'POST', endpoint: '/v3/positioning', description: 'Create positioning profile' },
    { method: 'GET', endpoint: '/v3/positioning/default', description: 'Get default positioning profile' },
    { method: 'GET', endpoint: '/v3/positioning/nametoidmap', description: 'Get positioning profile name map' },
    { method: 'GET', endpoint: '/v3/positioning/{positioningProfileId}', description: 'Get positioning profile by ID' },
    { method: 'PUT', endpoint: '/v3/positioning/{positioningProfileId}', description: 'Update positioning profile' },
    { method: 'DELETE', endpoint: '/v3/positioning/{positioningProfileId}', description: 'Delete positioning profile' },
    { method: 'GET', endpoint: '/v3/xlocation', description: 'Get XLocation profiles' },
    { method: 'POST', endpoint: '/v3/xlocation', description: 'Create XLocation profile' },
    { method: 'GET', endpoint: '/v3/xlocation/default', description: 'Get default XLocation profile' },
    { method: 'GET', endpoint: '/v3/xlocation/nametoidmap', description: 'Get XLocation profile name map' },
    { method: 'GET', endpoint: '/v3/xlocation/{xlocationId}', description: 'Get XLocation profile by ID' },
    { method: 'PUT', endpoint: '/v3/xlocation/{xlocationId}', description: 'Update XLocation profile' },
    { method: 'DELETE', endpoint: '/v3/xlocation/{xlocationId}', description: 'Delete XLocation profile' },
  ],

  'Mesh & Topology': [
    { method: 'GET', endpoint: '/v3/meshpoints', description: 'Get meshpoints' },
    { method: 'POST', endpoint: '/v3/meshpoints', description: 'Create meshpoint' },
    { method: 'GET', endpoint: '/v3/meshpoints/default', description: 'Get default meshpoint' },
    { method: 'GET', endpoint: '/v3/meshpoints/profile/default', description: 'Get default meshpoint profile' },
    { method: 'GET', endpoint: '/v3/meshpoints/nametoidmap', description: 'Get meshpoint name map' },
    { method: 'GET', endpoint: '/v3/meshpoints/{meshpointId}', description: 'Get meshpoint by ID' },
    { method: 'PUT', endpoint: '/v3/meshpoints/{meshpointId}', description: 'Update meshpoint' },
    { method: 'DELETE', endpoint: '/v3/meshpoints/{meshpointId}', description: 'Delete meshpoint' },
    { method: 'GET', endpoint: '/v3/meshpoints/tree/{meshpointId}', description: 'Get meshpoint tree' },
    { method: 'GET', endpoint: '/v3/meshpoints/{meshpointId}/bssid', description: 'Get meshpoint BSSID' },
    { method: 'GET', endpoint: '/v1/topologies', description: 'Get topologies (v1)' },
    { method: 'POST', endpoint: '/v1/topologies', description: 'Create topology (v1)' },
    { method: 'GET', endpoint: '/v1/topologies/default', description: 'Get default topology (v1)' },
    { method: 'GET', endpoint: '/v1/topologies/nametoidmap', description: 'Get topology name map (v1)' },
    { method: 'GET', endpoint: '/v1/topologies/{topologyId}', description: 'Get topology by ID (v1)' },
    { method: 'PUT', endpoint: '/v1/topologies/{topologyId}', description: 'Update topology (v1)' },
    { method: 'DELETE', endpoint: '/v1/topologies/{topologyId}', description: 'Delete topology (v1)' },
    { method: 'GET', endpoint: '/v3/topologies', description: 'Get topologies (v3)' },
  ],

  'Guest Access & AAA': [
    { method: 'GET', endpoint: '/v1/eguest', description: 'Get EGuest services' },
    { method: 'POST', endpoint: '/v1/eguest', description: 'Create EGuest service' },
    { method: 'GET', endpoint: '/v1/eguest/default', description: 'Get default EGuest configuration' },
    { method: 'GET', endpoint: '/v1/eguest/nametoidmap', description: 'Get EGuest name to ID map' },
    { method: 'GET', endpoint: '/v1/eguest/{eguestId}', description: 'Get EGuest by ID' },
    { method: 'PUT', endpoint: '/v1/eguest/{eguestId}', description: 'Update EGuest' },
    { method: 'DELETE', endpoint: '/v1/eguest/{eguestId}', description: 'Delete EGuest' },
    { method: 'GET', endpoint: '/v1/aaapolicy', description: 'Get AAA policies' },
    { method: 'POST', endpoint: '/v1/aaapolicy', description: 'Create AAA policy' },
    { method: 'GET', endpoint: '/v1/aaapolicy/default', description: 'Get default AAA policy' },
    { method: 'GET', endpoint: '/v1/aaapolicy/nametoidmap', description: 'Get AAA policy name map' },
    { method: 'GET', endpoint: '/v1/aaapolicy/{id}', description: 'Get AAA policy by ID' },
    { method: 'PUT', endpoint: '/v1/aaapolicy/{id}', description: 'Update AAA policy' },
    { method: 'DELETE', endpoint: '/v1/aaapolicy/{id}', description: 'Delete AAA policy' },
  ],

  'MSP & Multi-tenant': [
    { method: 'GET', endpoint: '/v1/msp/briefsites/{tenantId}', description: 'Get MSP brief sites for tenant' },
  ],
};

// Optimize component with memo
const ApiTestTool = memo(() => {
  const [currentMethod, setCurrentMethod] = useState('GET');
  const [currentEndpoint, setCurrentEndpoint] = useState('');
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestHistory, setRequestHistory] = useState<ApiRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [isMounted, setIsMounted] = useState(true);
  const [collections, setCollections] = useState<Record<string, CollectionItem[]>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [isLoadingCollections, setIsLoadingCollections] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [endpointTemplate, setEndpointTemplate] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [responseViewMode, setResponseViewMode] = useState<'pretty' | 'raw' | 'headers' | 'preview'>('pretty');

  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

  const fetchCollections = useCallback(async () => {
    if (!apiService.isAuthenticated()) return;
    setIsLoadingCollections(true);

    const results = await Promise.allSettled(
      COLLECTION_CONFIGS.map(async (config) => {
        const response = await apiService.makeAuthenticatedRequest(config.endpoint);
        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        // API may return array directly or under a wrapper key
        const items: Record<string, unknown>[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data) ? data.data
          : Array.isArray(data?.items) ? data.items
          : Array.isArray(data?.result) ? data.result
          : [];
        return {
          key: config.key,
          items: items.map((item) => ({
            value: extractField(item, config.valueField),
            label: extractField(item, config.labelField),
          })),
        };
      })
    );

    const newCollections: Record<string, CollectionItem[]> = {};
    const newSelections: Record<string, string> = {};

    results.forEach((result, index) => {
      const config = COLLECTION_CONFIGS[index];
      if (result.status === 'fulfilled' && result.value.items.length > 0) {
        newCollections[config.key] = result.value.items;
        newSelections[config.key] = result.value.items[0].value;
      } else {
        console.warn(`[Collections] Failed to fetch ${config.key}:`, result.status === 'rejected' ? result.reason : 'empty');
        newCollections[config.key] = [];
        if (config.fallback) {
          newSelections[config.key] = config.fallback;
        }
      }
    });

    setCollections(newCollections);
    setSelections(newSelections);
    setIsLoadingCollections(false);
  }, []);

  // Fetch collections when authenticated
  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Parse {param} names from the current endpoint template
  const endpointParams = useMemo(() => {
    if (!endpointTemplate) return [];
    const matches = endpointTemplate.match(/\{([^}]+)\}/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  }, [endpointTemplate]);

  // Rebuild the resolved endpoint whenever template or paramValues change
  useEffect(() => {
    if (!endpointTemplate) return;
    let resolved = endpointTemplate;
    for (const [name, value] of Object.entries(paramValues)) {
      if (value) {
        resolved = resolved.replaceAll(`{${name}}`, value);
      }
    }
    setCurrentEndpoint(resolved);
  }, [endpointTemplate, paramValues]);

  // Memoize filtered endpoints for performance
  const filteredEndpoints = useMemo(() => {
    if (selectedCategory === 'all') {
      if (!searchTerm) {
        return endpointCategories;
      }
      
      const filtered: Record<string, EndpointInfo[]> = {};
      Object.entries(endpointCategories).forEach(([category, endpoints]) => {
        const matchingEndpoints = endpoints.filter(
          endpoint =>
            endpoint.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
            endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            endpoint.method.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (matchingEndpoints.length > 0) {
          filtered[category] = matchingEndpoints;
        }
      });
      return filtered;
    } else {
      if (selectedCategory in endpointCategories) {
        const categoryEndpoints = endpointCategories[selectedCategory];
        if (!searchTerm) {
          return { [selectedCategory]: categoryEndpoints };
        }
        const filtered = categoryEndpoints.filter(
          endpoint =>
            endpoint.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
            endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            endpoint.method.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return filtered.length > 0 ? { [selectedCategory]: filtered } : {};
      }
      return {};
    }
  }, [selectedCategory, searchTerm]);

  // Memoize category names for filter dropdown
  const categoryNames = useMemo(() => Object.keys(endpointCategories), []);

  const copyToClipboard = useCallback(async (text: string, label?: string) => {
    const fallbackCopy = () => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          toast.success(`Copied ${label || 'content'} to clipboard`);
          return true;
        } else {
          throw new Error('execCommand copy failed');
        }
      } catch (err) {
        console.error('Fallback copy failed:', err);
        toast.error('Unable to copy to clipboard - please copy manually');
        return false;
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(`Copied ${label || 'content'} to clipboard`);
        return;
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback:', err);
        fallbackCopy();
        return;
      }
    }
    
    fallbackCopy();
  }, []);

  const saveResponseToFile = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Saved as ${filename}`);
  }, []);

  const getResponseContent = useCallback((mode: string, res: ApiResponse): string => {
    switch (mode) {
      case 'pretty':
        try {
          return JSON.stringify(JSON.parse(res.body), null, 2);
        } catch {
          return res.body;
        }
      case 'raw':
        try {
          return JSON.stringify(JSON.parse(res.body));
        } catch {
          return res.body;
        }
      case 'headers':
        return Object.entries(res.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n') || 'No headers available';
      case 'preview': {
        try {
          const parsed = JSON.parse(res.body);
          const data = Array.isArray(parsed) ? parsed
            : Array.isArray(parsed?.data) ? parsed.data
            : Array.isArray(parsed?.items) ? parsed.items
            : Array.isArray(parsed?.result) ? parsed.result
            : null;
          if (data) {
            return `${data.length} item${data.length !== 1 ? 's' : ''} returned\n\n` +
              data.slice(0, 5).map((item: Record<string, unknown>, i: number) =>
                `[${i}] ${JSON.stringify(item, null, 2)}`
              ).join('\n\n') +
              (data.length > 5 ? `\n\n... and ${data.length - 5} more items` : '');
          }
          const keys = Object.keys(parsed);
          return `Object with ${keys.length} key${keys.length !== 1 ? 's' : ''}: ${keys.join(', ')}\n\n${JSON.stringify(parsed, null, 2)}`;
        } catch {
          return res.body;
        }
      }
      default:
        return res.body;
    }
  }, []);

  const executeRequest = useCallback(async () => {
    if (!currentEndpoint.trim()) {
      toast.error('Please enter an endpoint');
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    try {
      const options: RequestInit = {
        method: currentMethod,
      };

      if (['POST', 'PUT', 'PATCH'].includes(currentMethod) && requestBody.trim()) {
        options.body = requestBody;
      }

      const response = await apiService.makeAuthenticatedRequest(currentEndpoint, options);
      const endTime = Date.now();
      const duration = endTime - startTime;

      let responseBody = '';
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          const jsonData = await response.json();
          responseBody = JSON.stringify(jsonData, null, 2);
        } catch (e) {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const apiResponse: ApiResponse = {
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
        headers,
        duration,
      };

      setResponse(apiResponse);

      // Add to history
      const newRequest: ApiRequest = {
        id: `${Date.now()}-${Math.random()}`,
        method: currentMethod,
        endpoint: currentEndpoint,
        body: requestBody || undefined,
        timestamp: new Date(),
      };

      setRequestHistory(prev => [newRequest, ...prev.slice(0, 49)]);

      if (response.ok) {
        toast.success(`Request completed in ${duration}ms`);
      } else {
        toast.error(`Request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (!isMounted) return;
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const errorResponse: ApiResponse = {
        status: 0,
        statusText: 'Network Error',
        body: `Error: ${errorMessage}`,
        headers: {},
        duration,
      };

      setResponse(errorResponse);
      toast.error('API request failed', {
        description: errorMessage
      });
    } finally {
      if (isMounted) {
        setIsLoading(false);
      }
    }
  }, [currentMethod, currentEndpoint, requestBody, isMounted]);

  const clearHistory = useCallback(() => {
    setRequestHistory([]);
    toast.success('Request history cleared');
  }, []);

  const loadFromHistory = useCallback((request: ApiRequest) => {
    setCurrentMethod(request.method);
    setCurrentEndpoint(request.endpoint);
    setEndpointTemplate('');
    setParamValues({});
    setRequestBody(request.body || '');
    toast.success('Request loaded from history');
  }, []);

  const updateParam = useCallback((paramName: string, value: string) => {
    setParamValues(prev => ({ ...prev, [paramName]: value }));
    // Sync to global selections if this param maps to a collection
    const config = resolveParamConfig(endpointTemplate, paramName);
    if (config) {
      setSelections(prev => ({ ...prev, [config.key]: value }));
    }
  }, [endpointTemplate]);

  const loadEndpoint = useCallback((endpoint: EndpointInfo) => {
    setCurrentMethod(endpoint.method);
    setEndpointTemplate(endpoint.endpoint);

    // Parse params and set initial values from selections/static defaults
    const params = endpoint.endpoint.match(/\{([^}]+)\}/g) || [];
    const initialValues: Record<string, string> = {};

    for (const param of params) {
      const paramName = param.slice(1, -1);
      const config = resolveParamConfig(endpoint.endpoint, paramName);
      if (config && selections[config.key]) {
        initialValues[paramName] = selections[config.key];
      } else if (staticPlaceholders[param]) {
        initialValues[paramName] = staticPlaceholders[param];
      } else {
        initialValues[paramName] = '';
      }
    }

    setParamValues(initialValues);
    setRequestBody('');
    toast.success(`Loaded ${endpoint.method} ${endpoint.endpoint}`);
  }, [selections]);

  const toggleCategory = useCallback((category: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 h-full gap-0">
          {/* Left Panel: API Browser */}
          <div className="flex flex-col border-r border-border bg-card">
            {/* Active Defaults Bar */}
            <div className="border-b border-border">
              <Collapsible open={defaultsOpen} onOpenChange={setDefaultsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-3 h-auto rounded-none hover:bg-accent/50"
                  >
                    <div className="flex items-center space-x-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Active Defaults</span>
                      <Badge variant="secondary" className="text-xs">
                        {Object.values(selections).filter(Boolean).length}
                      </Badge>
                      {isLoadingCollections && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                    {defaultsOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2">
                    {COLLECTION_CONFIGS.map((config) => {
                      const items = collections[config.key] || [];
                      const hasItems = items.length > 0;
                      return (
                        <div key={config.key} className="flex items-center space-x-2">
                          <Label className="text-xs text-muted-foreground w-20 shrink-0 text-right">
                            {config.displayName}
                          </Label>
                          {isLoadingCollections ? (
                            <div className="flex-1 h-8 bg-muted animate-pulse rounded-md" />
                          ) : (
                            <Select
                              value={selections[config.key] || ''}
                              onValueChange={(value) =>
                                setSelections((prev) => ({ ...prev, [config.key]: value }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder={hasItems ? 'Select...' : 'No data'} />
                              </SelectTrigger>
                              <SelectContent>
                                {hasItems ? (
                                  items.map((item) => (
                                    <SelectItem key={item.value} value={item.value} className="text-xs">
                                      {item.label !== item.value
                                        ? `${item.label} (${item.value})`
                                        : item.value}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value={config.fallback || '__none__'} disabled={!config.fallback} className="text-xs">
                                    {config.fallback ? `${config.fallback} (default)` : 'No data available'}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={fetchCollections}
                        disabled={isLoadingCollections}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingCollections ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="p-4 border-b border-border bg-muted/30">
              <div className="flex items-center space-x-2 mb-3">
                <Book className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">API Explorer</h2>
                <Badge variant="secondary" className="ml-auto">
                  {Object.values(filteredEndpoints).reduce((sum, endpoints) => sum + endpoints.length, 0)} endpoints
                </Badge>
              </div>
              
              <div className="flex space-x-2 mb-3">
                <div className="flex-1">
                  <Label htmlFor="search" className="sr-only">Search endpoints</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search endpoints..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="w-48">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoryNames.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCategory !== 'all' && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-accent/50 px-3 py-2 rounded-md">
                  <Filter className="h-4 w-4" />
                  <span>Filtered: {selectedCategory}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCategory('all')}
                    className="h-6 px-2 text-xs ml-auto"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {Object.entries(filteredEndpoints).map(([category, endpoints]) => (
                  <Collapsible
                    key={category}
                    open={openCategories[category] ?? false}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto hover:bg-accent text-foreground"
                      >
                        <span className="font-medium text-left">{category}</span>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">{endpoints.length}</Badge>
                          {openCategories[category] ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1 pl-4 mt-2">
                        {endpoints.map((endpoint, index) => (
                          <div
                            key={`${endpoint.method}-${endpoint.endpoint}-${index}`}
                            className="group p-3 rounded-md border border-border bg-card hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => loadEndpoint(endpoint)}
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              <Badge
                                variant={
                                  endpoint.method === 'GET' ? 'default' :
                                  endpoint.method === 'POST' ? 'secondary' :
                                  endpoint.method === 'PUT' ? 'outline' :
                                  'destructive'
                                }
                                className="text-xs font-mono"
                              >
                                {endpoint.method}
                              </Badge>
                              <code className="text-sm font-mono text-foreground break-all">
                                {endpoint.endpoint}
                              </code>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {endpoint.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel: Request Builder & Response */}
          <div className="flex flex-col bg-background">
            <Tabs defaultValue="builder" className="flex-1 flex flex-col min-h-0">
              <div className="border-b border-border px-4 pt-2">
                <TabsList className="tab-bar">
                  <TabsTrigger value="builder" className="tab-underline">
                    <Code className="h-4 w-4" />
                    API Testing
                  </TabsTrigger>
                  <TabsTrigger value="history" className="tab-underline">
                    <History className="h-4 w-4" />
                    Request History
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="builder" className="flex-1 min-h-0 m-0">
                <div className="h-full flex flex-col">
                  {/* Request Builder Section */}
                  <div className="p-4 pb-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center space-x-2">
                          <Code className="h-5 w-5" />
                          <span>Request Builder</span>
                        </CardTitle>
                        <CardDescription>
                          Configure and execute API requests
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <Label htmlFor="method">Method</Label>
                            <Select value={currentMethod} onValueChange={setCurrentMethod}>
                              <SelectTrigger id="method">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GET">GET</SelectItem>
                                <SelectItem value="POST">POST</SelectItem>
                                <SelectItem value="PUT">PUT</SelectItem>
                                <SelectItem value="DELETE">DELETE</SelectItem>
                                <SelectItem value="PATCH">PATCH</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <Label htmlFor="endpoint">Endpoint</Label>
                            <Input
                              id="endpoint"
                              placeholder="/v1/example"
                              value={currentEndpoint}
                              onChange={(e) => setCurrentEndpoint(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Inline Parameter Dropdowns */}
                        {endpointParams.length > 0 && (
                          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                              Path Parameters
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                              {endpointParams.map((paramName) => {
                                const config = resolveParamConfig(endpointTemplate, paramName);
                                const staticOpts = STATIC_PARAM_OPTIONS[paramName];

                                if (config) {
                                  const items = collections[config.key] || [];
                                  return (
                                    <div key={paramName} className="space-y-1">
                                      <Label className="text-xs font-medium">{config.displayName}</Label>
                                      {isLoadingCollections ? (
                                        <div className="h-8 bg-muted animate-pulse rounded-md" />
                                      ) : (
                                        <Select
                                          value={paramValues[paramName] || ''}
                                          onValueChange={(v) => updateParam(paramName, v)}
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder={items.length > 0 ? 'Select...' : 'No data'} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {items.map((item) => (
                                              <SelectItem key={item.value} value={item.value} className="text-xs">
                                                {item.label !== item.value
                                                  ? `${item.label} (${item.value})`
                                                  : item.value}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  );
                                }

                                if (staticOpts) {
                                  return (
                                    <div key={paramName} className="space-y-1">
                                      <Label className="text-xs font-medium">{staticOpts.label}</Label>
                                      <Select
                                        value={paramValues[paramName] || ''}
                                        onValueChange={(v) => updateParam(paramName, v)}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {staticOpts.options.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                              {opt.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  );
                                }

                                return (
                                  <div key={paramName} className="space-y-1">
                                    <Label className="text-xs font-medium">{paramName}</Label>
                                    <Input
                                      className="h-8 text-xs"
                                      value={paramValues[paramName] || ''}
                                      onChange={(e) => updateParam(paramName, e.target.value)}
                                      placeholder={`Enter ${paramName}...`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {['POST', 'PUT', 'PATCH'].includes(currentMethod) && (
                          <div>
                            <Label htmlFor="body">Request Body (JSON)</Label>
                            <Textarea
                              id="body"
                              placeholder='{"key": "value"}'
                              value={requestBody}
                              onChange={(e) => setRequestBody(e.target.value)}
                              className="font-mono text-sm min-h-[100px]"
                            />
                          </div>
                        )}

                        <div className="flex space-x-2 pt-2">
                          <Button
                            onClick={executeRequest}
                            disabled={isLoading || !currentEndpoint.trim()}
                            className="flex items-center space-x-2"
                          >
                            <Play className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
                            <span>{isLoading ? 'Sending...' : 'Send Request'}</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            onClick={() => copyToClipboard(currentEndpoint, 'endpoint')}
                            disabled={!currentEndpoint.trim()}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Response Section */}
                  <div className="flex-1 min-h-0 p-4 pt-2">
                    <Card className="h-full flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Download className="h-5 w-5" />
                            <span>Response</span>
                          </div>
                          {response && (
                            <div className="flex items-center space-x-2">
                              <Badge
                                variant={response.status >= 200 && response.status < 300 ? 'default' : 'destructive'}
                              >
                                {response.status} {response.statusText}
                              </Badge>
                              <Badge variant="outline">
                                {response.duration}ms
                              </Badge>
                            </div>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col min-h-0">
                        {response ? (
                          <div className="flex-1 flex flex-col min-h-0">
                            {/* View mode tabs + action buttons */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="response-tab-bar">
                                <button
                                  className={`response-tab ${responseViewMode === 'pretty' ? 'response-tab-active' : ''}`}
                                  onClick={() => setResponseViewMode('pretty')}
                                >
                                  <FileJson className="h-3.5 w-3.5" />
                                  Pretty
                                </button>
                                <button
                                  className={`response-tab ${responseViewMode === 'raw' ? 'response-tab-active' : ''}`}
                                  onClick={() => setResponseViewMode('raw')}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Raw
                                </button>
                                <button
                                  className={`response-tab ${responseViewMode === 'headers' ? 'response-tab-active' : ''}`}
                                  onClick={() => setResponseViewMode('headers')}
                                >
                                  <ListTree className="h-3.5 w-3.5" />
                                  Headers
                                </button>
                                <button
                                  className={`response-tab ${responseViewMode === 'preview' ? 'response-tab-active' : ''}`}
                                  onClick={() => setResponseViewMode('preview')}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  Preview
                                </button>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => copyToClipboard(
                                    getResponseContent(responseViewMode, response),
                                    responseViewMode === 'headers' ? 'headers' : 'response'
                                  )}
                                >
                                  <Copy className="h-3.5 w-3.5 mr-1" />
                                  Copy
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => {
                                    const ext = responseViewMode === 'headers' ? 'txt' : 'json';
                                    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                                    saveResponseToFile(
                                      getResponseContent(responseViewMode, response),
                                      `response-${ts}.${ext}`
                                    );
                                  }}
                                >
                                  <Save className="h-3.5 w-3.5 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>

                            {/* Response body */}
                            <div className="flex-1 min-h-0">
                              <ScrollArea className="h-full">
                                <pre className="text-sm font-mono whitespace-pre-wrap break-words p-4 bg-muted/50 border border-border rounded-md text-foreground">
                                  {getResponseContent(responseViewMode, response)}
                                </pre>
                              </ScrollArea>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                              <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                              <p>No response yet</p>
                              <p className="text-sm">Send a request to see the response here</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="history" className="flex-1 min-h-0 m-0">
                <div className="h-full flex flex-col p-4">
                  <Card className="flex-1 flex flex-col min-h-0">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Upload className="h-5 w-5" />
                          <span>Request History</span>
                        </div>
                        {requestHistory.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearHistory}
                            className="flex items-center space-x-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Clear</span>
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0">
                      {requestHistory.length > 0 ? (
                        <ScrollArea className="h-full">
                          <div className="space-y-2">
                            {requestHistory.map((request) => (
                              <div
                                key={request.id}
                                className="p-3 border border-border bg-card rounded-md cursor-pointer hover:bg-accent transition-colors"
                                onClick={() => loadFromHistory(request)}
                              >
                                <div className="flex items-center space-x-2 mb-1">
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {request.method}
                                  </Badge>
                                  <code className="text-sm font-mono text-foreground break-all">
                                    {request.endpoint}
                                  </code>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {request.timestamp.toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                          <div className="text-center">
                            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>No request history</p>
                            <p className="text-sm">Your sent requests will appear here</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
});

ApiTestTool.displayName = 'ApiTestTool';

export { ApiTestTool };