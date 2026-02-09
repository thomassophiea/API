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
import { Play, Copy, Trash2, Filter, ChevronDown, ChevronRight, Code, Download, Upload, Book, Search } from 'lucide-react';
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

  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

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
    setRequestBody(request.body || '');
    toast.success('Request loaded from history');
  }, []);

  const loadEndpoint = useCallback((endpoint: EndpointInfo) => {
    setCurrentMethod(endpoint.method);
    setCurrentEndpoint(endpoint.endpoint);
    setRequestBody('');
    toast.success(`Loaded ${endpoint.method} ${endpoint.endpoint}`);
  }, []);

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
              <TabsList className="grid w-full grid-cols-2 m-4 bg-muted">
                <TabsTrigger value="builder">API Testing</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              
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
                      <CardHeader className="pb-3">
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
                          <div className="flex-1 flex flex-col space-y-3 min-h-0">
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(response.body, 'response')}
                                className="flex items-center space-x-1"
                              >
                                <Copy className="h-3 w-3" />
                                <span>Copy Response</span>
                              </Button>
                            </div>
                            
                            <div className="flex-1 min-h-0">
                              <ScrollArea className="h-full">
                                <pre className="text-sm font-mono whitespace-pre-wrap break-words p-4 bg-muted/50 border border-border rounded-md text-foreground">
                                  {response.body}
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