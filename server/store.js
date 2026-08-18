import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

/**
 * Lightweight JSON-file-backed store for Gateway connection profiles.
 *
 * Deliberately NOT a database engine (SQLite/Postgres/etc.) - a local
 * engineering utility does not need one, and a flat file keeps the
 * local developer/Docker experience dependency-free and portable.
 *
 * IMPORTANT: only non-secret connection metadata is ever written to
 * disk. Passwords are never persisted here - see server/credentials.js.
 */

const DEFAULT_STORE_PATH = path.resolve(process.cwd(), 'data', 'gateways.json');

function emptyState() {
  return { gateways: [], activeGatewayId: null };
}

export class GatewayStore {
  constructor(storePath = process.env.GATEWAY_STORE_PATH || DEFAULT_STORE_PATH) {
    this.storePath = storePath;
    this._writeChain = Promise.resolve();
  }

  async _load() {
    try {
      const raw = await fs.readFile(this.storePath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        gateways: Array.isArray(parsed.gateways) ? parsed.gateways : [],
        activeGatewayId: parsed.activeGatewayId ?? null,
      };
    } catch (err) {
      if (err.code === 'ENOENT') return emptyState();
      throw err;
    }
  }

  async _save(state) {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    const tmpPath = `${this.storePath}.${process.pid}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.storePath);
  }

  /** Serializes mutations so concurrent requests can't clobber each other. */
  _mutate(fn) {
    this._writeChain = this._writeChain.then(async () => {
      const state = await this._load();
      const result = await fn(state);
      await this._save(state);
      return result;
    });
    return this._writeChain;
  }

  async list() {
    const state = await this._load();
    return state.gateways;
  }

  async get(id) {
    const state = await this._load();
    return state.gateways.find((g) => g.id === id) || null;
  }

  async getActiveId() {
    const state = await this._load();
    return state.activeGatewayId;
  }

  async create(profile) {
    return this._mutate((state) => {
      const now = new Date().toISOString();
      const record = {
        id: randomUUID(),
        name: profile.name,
        host: profile.host,
        port: profile.port ?? 443,
        protocol: profile.protocol ?? 'https',
        username: profile.username ?? '',
        trustSelfSigned: Boolean(profile.trustSelfSigned),
        locked: Boolean(profile.locked),
        createdAt: now,
        updatedAt: now,
      };
      state.gateways.push(record);
      if (!state.activeGatewayId) state.activeGatewayId = record.id;
      return record;
    });
  }

  async update(id, patch) {
    return this._mutate((state) => {
      const idx = state.gateways.findIndex((g) => g.id === id);
      if (idx === -1) return null;
      const existing = state.gateways[idx];
      if (existing.locked) {
        // Locked (hosted/legacy) gateways may not have their target changed,
        // preventing the hosted deployment from being repointed at an
        // arbitrary host via the API.
        const { name } = patch;
        state.gateways[idx] = { ...existing, name: name ?? existing.name, updatedAt: new Date().toISOString() };
        return state.gateways[idx];
      }
      state.gateways[idx] = {
        ...existing,
        ...patch,
        id: existing.id,
        locked: existing.locked,
        updatedAt: new Date().toISOString(),
      };
      return state.gateways[idx];
    });
  }

  async remove(id) {
    return this._mutate((state) => {
      const existing = state.gateways.find((g) => g.id === id);
      if (existing?.locked) {
        throw Object.assign(new Error('This Gateway is managed by the hosted deployment and cannot be deleted.'), { statusCode: 403 });
      }
      state.gateways = state.gateways.filter((g) => g.id !== id);
      if (state.activeGatewayId === id) {
        state.activeGatewayId = state.gateways[0]?.id ?? null;
      }
      return true;
    });
  }

  async setActive(id) {
    return this._mutate((state) => {
      if (id !== null && !state.gateways.some((g) => g.id === id)) {
        throw Object.assign(new Error('Gateway not found'), { statusCode: 404 });
      }
      state.activeGatewayId = id;
      return id;
    });
  }
}

export const gatewayStore = new GatewayStore();
