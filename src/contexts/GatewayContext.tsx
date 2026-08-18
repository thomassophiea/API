import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { gatewayClient, type GatewayProfile, type GatewayInput, type TestConnectionResult } from '../services/gatewayClient';
import { apiService } from '../services/api';

interface GatewayContextValue {
  gateways: GatewayProfile[];
  activeGatewayId: string | null;
  activeGateway: GatewayProfile | null;
  appMode: 'local' | 'hosted';
  allowCustomGateways: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addGateway: (input: GatewayInput) => Promise<GatewayProfile>;
  editGateway: (id: string, patch: Partial<GatewayInput>) => Promise<GatewayProfile>;
  deleteGateway: (id: string) => Promise<void>;
  selectGateway: (id: string) => Promise<void>;
  testGateway: (id: string, credentials?: { username: string; password: string; remember?: boolean }) => Promise<TestConnectionResult>;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

export function GatewayProvider({ children }: { children: ReactNode }) {
  const [gateways, setGateways] = useState<GatewayProfile[]>([]);
  const [activeGatewayId, setActiveGatewayId] = useState<string | null>(null);
  const [appMode, setAppMode] = useState<'local' | 'hosted'>('local');
  const [allowCustomGateways, setAllowCustomGateways] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gatewayClient.list();
      setGateways(data.gateways);
      setActiveGatewayId(data.activeGatewayId);
      setAppMode(data.appMode);
      setAllowCustomGateways(data.allowCustomGateways);
      apiService.setActiveGateway(data.activeGatewayId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Gateways');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addGateway = useCallback(async (input: GatewayInput) => {
    const created = await gatewayClient.create(input);
    await refresh();
    return created;
  }, [refresh]);

  const editGateway = useCallback(async (id: string, patch: Partial<GatewayInput>) => {
    const updated = await gatewayClient.update(id, patch);
    await refresh();
    return updated;
  }, [refresh]);

  const deleteGateway = useCallback(async (id: string) => {
    await gatewayClient.remove(id);
    await refresh();
  }, [refresh]);

  const selectGateway = useCallback(async (id: string) => {
    if (id !== activeGatewayId) {
      // Switching Gateways always requires re-authentication against the
      // newly selected Gateway - this prevents a request mid-workflow
      // from accidentally landing on the previous Gateway's session.
      await apiService.logout();
    }
    await gatewayClient.select(id);
    await refresh();
  }, [activeGatewayId, refresh]);

  const testGateway = useCallback(async (id: string, credentials?: { username: string; password: string; remember?: boolean }) => {
    const result = await gatewayClient.test(id, credentials);
    return result;
  }, []);

  const activeGateway = useMemo(
    () => gateways.find((g) => g.id === activeGatewayId) || null,
    [gateways, activeGatewayId],
  );

  const value = useMemo<GatewayContextValue>(() => ({
    gateways,
    activeGatewayId,
    activeGateway,
    appMode,
    allowCustomGateways,
    loading,
    error,
    refresh,
    addGateway,
    editGateway,
    deleteGateway,
    selectGateway,
    testGateway,
  }), [gateways, activeGatewayId, activeGateway, appMode, allowCustomGateways, loading, error, refresh, addGateway, editGateway, deleteGateway, selectGateway, testGateway]);

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway(): GatewayContextValue {
  const ctx = useContext(GatewayContext);
  if (!ctx) throw new Error('useGateway must be used within a GatewayProvider');
  return ctx;
}
