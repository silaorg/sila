import type { ClientState } from "@sila/client/state/clientState.svelte";
import { savePointers, appendTreeOps, saveAllSecrets } from "@sila/client/localDb";
import type { SpaceCreationResponse } from "@sila/core";
import type { SpacePointer } from "@sila/client/spaces/SpacePointer";

// API Base URL - should match the server
// Use Vite/SvelteKit env with a static property chain to satisfy SSR runner
export const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:6001';

export interface APIResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  status?: number;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
  client?: ClientState
): Promise<APIResponse<T>> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {};

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    // Add authorization header if user is authenticated
    if (client) {
      const authHeader = await client.auth.getAuthHeader();
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && client) {
      // Token might be expired, logout user
      client.auth.logout();
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      return {
        success: false,
        error: (data as any)?.message || data || `HTTP ${response.status}`,
        status: response.status
      };
    }

    return {
      success: true,
      data,
      status: response.status
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0
    };
  }
}

// Convenience methods for common HTTP verbs
export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit, client?: ClientState) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }, client),

  post: <T = any>(endpoint: string, data?: any, options?: RequestInit, client?: ClientState) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, client),

  put: <T = any>(endpoint: string, data?: any, options?: RequestInit, client?: ClientState) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, client),

  delete: <T = any>(endpoint: string, options?: RequestInit, client?: ClientState) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }, client),

  patch: <T = any>(endpoint: string, data?: any, options?: RequestInit, client?: ClientState) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }, client),
};

export async function fetchSpaces(client: ClientState) {
  try {
    const response = await api.get("/spaces", undefined, client);
    if (response.success && response.data) {
      const payload = response.data as { spaces?: any[] };
      const rawSpaces = Array.isArray(payload?.spaces) ? payload.spaces : [];
      const spaces: SpacePointer[] = rawSpaces.map((space: any) => ({
        id: space.id,
        uri: `${API_BASE_URL}/spaces/${space.id}`,
        name: space.name,
        createdAt: new Date(space.created_at || space.createdAt),
        userId: space.owner_id,
      }));

      console.log(`User got ${spaces.length} spaces`);

      await savePointers(spaces);

      const existingIds = new Set(client.pointers.map(p => p.id));
      const newSpaces = spaces.filter(space => !existingIds.has(space.id));
      for (const space of newSpaces) {
        client.addSpacePointer(space);
      }
    }
  } catch (error) {
    console.error("Failed to fetch spaces:", error);
  }
}

export async function getSpaceTreeOps(client: ClientState, spaceId: string, treeId: string) {
  try {
    const response = await api.get(`/spaces/${spaceId}/${treeId}`, undefined, client);
    if (response.success && response.data) {
      await appendTreeOps(`${API_BASE_URL}/spaces/${spaceId}`, spaceId, treeId, response.data as any);
      return response.data;
    }
    return [] as any[];
  } catch (error) {
    console.error(`Failed to fetch tree operations for space ${spaceId}, tree ${treeId}:`, error);
    return [] as any[];
  }
} 
