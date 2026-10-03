import { GmailLabel } from './gmail.service';
import { PaymentGateway, TransactionType } from '../../types';

export interface DetailedGmailLabel extends GmailLabel {
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  messageListVisibility?: 'show' | 'hide';
}

/**
 * Direct mapping between supported payment gateways and target Gmail labels
 */
export interface GatewayLabelMapping {
  BKASH: string;
  NAGAD: string;
  STRIPE: string;
}

/**
 * Complete stored configuration structure for label mappings
 */
export interface StoredLabelMappingConfig {
  mappings: GatewayLabelMapping;
  defaultLabel: string;
  autoApplyLabels: boolean;
  lastUpdated: string;
}

/**
 * Backward-compatible mapping interface
 */
export interface DisbursementLabelMapping {
  defaultDisbursementLabel: string;
  bkashLabel: string;
  nagadLabel: string;
  stripeLabel: string;
  autoApplyLabels: boolean;
}

const STORAGE_KEY = 'payhub_gateway_label_mappings_v2';
const EVENT_NAME = 'payhub_label_mapping_updated';

export const DEFAULT_GATEWAY_MAPPINGS: GatewayLabelMapping = {
  BKASH: 'Payments/Disbursed',
  NAGAD: 'Payments/Disbursed',
  STRIPE: 'Payments/Received',
};

export const DEFAULT_CONFIG: StoredLabelMappingConfig = {
  mappings: DEFAULT_GATEWAY_MAPPINGS,
  defaultLabel: 'Payments/Disbursed',
  autoApplyLabels: true,
  lastUpdated: new Date().toISOString(),
};

/**
 * In-memory fallback if localStorage is unavailable
 */
let memoryFallbackConfig: StoredLabelMappingConfig = { ...DEFAULT_CONFIG };

/**
 * Retrieves the full stored label mapping configuration from localStorage
 */
export function getStoredMappingConfig(): StoredLabelMappingConfig {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryFallbackConfig;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
      return DEFAULT_CONFIG;
    }
    const parsed = JSON.parse(raw);
    return {
      mappings: {
        ...DEFAULT_GATEWAY_MAPPINGS,
        ...(parsed.mappings || {}),
      },
      defaultLabel: parsed.defaultLabel || DEFAULT_CONFIG.defaultLabel,
      autoApplyLabels: parsed.autoApplyLabels !== false,
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to read label mappings from localStorage:', err);
    return memoryFallbackConfig;
  }
}

/**
 * Persists the label mapping configuration to localStorage and broadcasts change
 */
export function saveStoredMappingConfig(config: StoredLabelMappingConfig): void {
  try {
    const serialized = JSON.stringify({
      ...config,
      lastUpdated: new Date().toISOString(),
    });
    memoryFallbackConfig = JSON.parse(serialized);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, serialized);
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: memoryFallbackConfig })
      );
    }
  } catch (err) {
    console.error('Failed to save label mappings to localStorage:', err);
  }
}

/**
 * Retrieves the user-defined Gmail label assigned to a specific payment gateway
 * @param gateway 'BKASH' | 'NAGAD' | 'STRIPE'
 */
export function getGatewayLabelMapping(gateway: PaymentGateway): string {
  const config = getStoredMappingConfig();
  return config.mappings[gateway] || config.defaultLabel || 'Payments/Disbursed';
}

/**
 * Updates the user-defined Gmail label mapping for a single payment gateway
 * @param gateway 'BKASH' | 'NAGAD' | 'STRIPE'
 * @param labelName Target label name in Gmail (e.g. "Payments/bKash")
 */
export function setGatewayLabelMapping(
  gateway: PaymentGateway | string,
  labelName: string
): StoredLabelMappingConfig {
  return saveGatewayLabelMapping(gateway, labelName);
}

/**
 * Retrieves all user-defined gateway label mappings as a simple key-value map
 */
export function getAllGatewayLabelMappings(): GatewayLabelMapping {
  return getStoredMappingConfig().mappings;
}

/**
 * Updates multiple gateway mappings simultaneously in localStorage with upfront validation
 */
export function updateAllGatewayLabelMappings(
  mappings: Partial<Record<PaymentGateway | string, string>>
): StoredLabelMappingConfig {
  if (!mappings || typeof mappings !== 'object') {
    throw new Error('Mappings argument must be a valid object.');
  }

  // Pre-validate all keys and label IDs before modifying state
  for (const [gw, lbl] of Object.entries(mappings)) {
    if (!isValidGatewayKey(gw)) {
      throw new Error(`Invalid gateway key: "${gw}". Expected one of: ${SUPPORTED_PAYMENT_GATEWAYS.join(', ')}`);
    }
    if (!isValidLabelId(lbl)) {
      throw new Error(`Invalid label ID for gateway "${gw}": "${lbl}". Must be a non-empty string.`);
    }
  }

  let latestConfig = getStoredMappingConfig();
  for (const [gw, lbl] of Object.entries(mappings)) {
    if (lbl) {
      latestConfig = saveGatewayLabelMapping(gw, lbl);
    }
  }
  return latestConfig;
}

/**
 * Resets user mappings back to system defaults
 */
export function resetGatewayLabelMappings(): StoredLabelMappingConfig {
  return clearGatewayMappings();
}

/**
 * Subscribes to changes in label mappings (supports cross-component & cross-tab sync)
 */
export function subscribeToLabelMappingChanges(
  callback: (config: StoredLabelMappingConfig) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<StoredLabelMappingConfig>;
    callback(customEvent.detail || getStoredMappingConfig());
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      callback(getStoredMappingConfig());
    }
  };

  window.addEventListener(EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

/**
 * Legacy Adapter: Loads user label mapping preferences
 */
export function getLabelMappingPreferences(): DisbursementLabelMapping {
  const config = getStoredMappingConfig();
  return {
    defaultDisbursementLabel: config.defaultLabel,
    bkashLabel: config.mappings.BKASH,
    nagadLabel: config.mappings.NAGAD,
    stripeLabel: config.mappings.STRIPE,
    autoApplyLabels: config.autoApplyLabels,
  };
}

/**
 * Legacy Adapter: Saves user label mapping preferences
 */
export function saveLabelMappingPreferences(mapping: DisbursementLabelMapping): void {
  const current = getStoredMappingConfig();
  const updated: StoredLabelMappingConfig = {
    mappings: {
      BKASH: mapping.bkashLabel || current.mappings.BKASH,
      NAGAD: mapping.nagadLabel || current.mappings.NAGAD,
      STRIPE: mapping.stripeLabel || current.mappings.STRIPE,
    },
    defaultLabel: mapping.defaultDisbursementLabel || current.defaultLabel,
    autoApplyLabels: mapping.autoApplyLabels !== false,
    lastUpdated: new Date().toISOString(),
  };
  saveStoredMappingConfig(updated);
}

/**
 * Dedicated storage keys and prefix for gateway-specific lookups
 */
export const GATEWAY_LOOKUP_STORAGE_PREFIX = 'payhub_gateway_label_';
export const GATEWAY_LOOKUP_TABLE_KEY = 'payhub_gateway_label_lookup_table';

/**
 * Supported payment gateways for label mapping
 */
export const SUPPORTED_PAYMENT_GATEWAYS: readonly PaymentGateway[] = ['BKASH', 'NAGAD', 'STRIPE'] as const;

/**
 * Validates whether the provided gateway key exists and is supported (Stripe, bKash, Nagad).
 * Case-insensitive check.
 */
export function isValidGatewayKey(gateway: unknown): gateway is PaymentGateway {
  if (!gateway || typeof gateway !== 'string') return false;
  const upper = gateway.trim().toUpperCase();
  return upper === 'BKASH' || upper === 'NAGAD' || upper === 'STRIPE';
}

/**
 * Validates that a label ID or name exists and is a non-empty string.
 */
export function isValidLabelId(labelId: unknown): labelId is string {
  return typeof labelId === 'string' && labelId.trim().length > 0;
}

/**
 * Normalizes gateway string to standard PaymentGateway enum
 */
export function normalizeGatewayKey(gateway: PaymentGateway | string): PaymentGateway {
  const upper = (gateway || '').toString().toUpperCase();
  if (upper.includes('BKASH')) return 'BKASH';
  if (upper.includes('NAGAD')) return 'NAGAD';
  if (upper.includes('STRIPE')) return 'STRIPE';
  return 'BKASH';
}

/**
 * Direct gateway lookup record structure stored in localStorage
 */
export interface GatewayMappingRecord {
  BKASH: string;
  NAGAD: string;
  STRIPE: string;
}

/**
 * Retrieves the direct gateway-specific lookup table from localStorage
 */
export function getGatewayLookupTable(): GatewayMappingRecord {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_GATEWAY_MAPPINGS };
    }
    const raw = window.localStorage.getItem(GATEWAY_LOOKUP_TABLE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        BKASH: parsed.BKASH || DEFAULT_GATEWAY_MAPPINGS.BKASH,
        NAGAD: parsed.NAGAD || DEFAULT_GATEWAY_MAPPINGS.NAGAD,
        STRIPE: parsed.STRIPE || DEFAULT_GATEWAY_MAPPINGS.STRIPE,
      };
    }
  } catch (err) {
    console.warn('Failed to parse gateway lookup table:', err);
  }
  return { ...DEFAULT_GATEWAY_MAPPINGS };
}

/**
 * Saves a mapping between a payment gateway and a specific Gmail label ID/name using localStorage,
 * structuring data for direct, efficient gateway-specific lookups.
 * 
 * Storage Architecture:
 * 1. Dedicated atomic key: `payhub_gateway_label_${gateway}` for instant O(1) key-based retrieval
 * 2. Dedicated gateway lookup table: `payhub_gateway_label_lookup_table`
 * 3. Master config object: `payhub_gateway_label_mappings_v2`
 * 
 * @param gateway 'STRIPE' | 'BKASH' | 'NAGAD' (case-insensitive string or PaymentGateway enum)
 * @param labelId The Gmail label ID or custom name
 */
export function saveGatewayLabelMapping(
  gateway: PaymentGateway | string,
  labelId: string
): StoredLabelMappingConfig {
  // 1. Validate gateway key exists and is supported (Stripe, bKash, Nagad)
  if (!isValidGatewayKey(gateway)) {
    const errorMsg = `Invalid or missing gateway key: "${String(gateway)}". Expected one of: ${SUPPORTED_PAYMENT_GATEWAYS.join(', ')}`;
    console.error(`[labelManager.service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // 2. Validate label ID exists and is a non-empty string
  if (!isValidLabelId(labelId)) {
    const errorMsg = `Invalid or missing label ID: "${String(labelId)}". A non-empty string label name or ID must be provided.`;
    console.error(`[labelManager.service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const normGateway = normalizeGatewayKey(gateway);
  const cleanLabel = labelId.trim();

  // 3. Direct gateway-specific key storage in localStorage for atomic retrieval
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`${GATEWAY_LOOKUP_STORAGE_PREFIX}${normGateway}`, cleanLabel);

      // 4. Structured gateway lookup table update
      const lookupTable = getGatewayLookupTable();
      lookupTable[normGateway] = cleanLabel;
      window.localStorage.setItem(GATEWAY_LOOKUP_TABLE_KEY, JSON.stringify(lookupTable));
    } catch (err) {
      console.warn(`Failed to store gateway mapping for ${normGateway} in localStorage:`, err);
    }
  }

  // 5. Update master config object and emit update events
  const current = getStoredMappingConfig();
  const updated: StoredLabelMappingConfig = {
    ...current,
    mappings: {
      ...current.mappings,
      [normGateway]: cleanLabel,
    },
    lastUpdated: new Date().toISOString(),
  };

  saveStoredMappingConfig(updated);
  return updated;
}

/**
 * Retrieves the user-defined Gmail label assigned to a specific payment gateway using localStorage,
 * optimized for gateway-specific lookups with multi-tier fallback resolution.
 * 
 * Lookup Order:
 * 1. Direct atomic key: `payhub_gateway_label_${gateway}` in localStorage
 * 2. Gateway lookup table: `payhub_gateway_label_lookup_table`
 * 3. Master config mappings in `payhub_gateway_label_mappings_v2`
 * 4. Memory fallback cache
 * 5. Gateway canonical default ('Payments/Received' for STRIPE, 'Payments/Disbursed' for BKASH/NAGAD)
 * 
 * @param gateway 'STRIPE' | 'BKASH' | 'NAGAD' (case-insensitive string or PaymentGateway enum)
 * @param type Optional transaction type for contextual fallback resolution
 */
export function getMappedLabelForGateway(
  gateway: PaymentGateway | string,
  type?: TransactionType
): string {
  const normGateway = normalizeGatewayKey(gateway);

  // 1. Check direct gateway-specific key in localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const directKeyVal = window.localStorage.getItem(`${GATEWAY_LOOKUP_STORAGE_PREFIX}${normGateway}`);
      if (directKeyVal && directKeyVal.trim()) {
        return directKeyVal.trim();
      }

      // 2. Check structured gateway lookup table
      const rawTable = window.localStorage.getItem(GATEWAY_LOOKUP_TABLE_KEY);
      if (rawTable) {
        const table = JSON.parse(rawTable);
        if (table && table[normGateway] && typeof table[normGateway] === 'string' && table[normGateway].trim()) {
          return table[normGateway].trim();
        }
      }
    } catch (err) {
      console.warn(`Error reading gateway lookup for ${normGateway}:`, err);
    }
  }

  // 3. Check master configuration mapping
  const config = getStoredMappingConfig();
  if (type === 'PAYMENT_RECEIVED' && !config.mappings[normGateway]) {
    return config.mappings.STRIPE || 'Payments/Received';
  }

  const mapped = config.mappings[normGateway];
  if (mapped && mapped.trim()) {
    return mapped.trim();
  }

  // 4. Canonical system default fallback
  return normGateway === 'STRIPE'
    ? 'Payments/Received'
    : (config.defaultLabel || 'Payments/Disbursed');
}

/**
 * Retrieves all gateway mappings structured as a typed record directly from localStorage
 */
export function getAllMappedLabelsByGateway(): GatewayLabelMapping {
  return {
    BKASH: getMappedLabelForGateway('BKASH'),
    NAGAD: getMappedLabelForGateway('NAGAD'),
    STRIPE: getMappedLabelForGateway('STRIPE'),
  };
}

/**
 * Checks if a specific payment gateway has a user-configured label mapping in localStorage
 */
export function hasGatewayLabelMapping(gateway: PaymentGateway | string): boolean {
  const normGateway = normalizeGatewayKey(gateway);
  if (typeof window !== 'undefined' && window.localStorage) {
    const directVal = window.localStorage.getItem(`${GATEWAY_LOOKUP_STORAGE_PREFIX}${normGateway}`);
    if (directVal && directVal.trim()) return true;
  }
  const config = getStoredMappingConfig();
  return Boolean(config.mappings[normGateway]);
}

/**
 * Resets a single gateway's label mapping back to its default value
 */
export function resetGatewayLabelMapping(gateway: PaymentGateway | string): string {
  const normGateway = normalizeGatewayKey(gateway);
  const defaultLabel = DEFAULT_GATEWAY_MAPPINGS[normGateway] || 'Payments/Disbursed';
  saveGatewayLabelMapping(normGateway, defaultLabel);
  return defaultLabel;
}

/**
 * Fully clears and resets user gateway label configurations in localStorage back to default values.
 * If a specific gateway is specified ('STRIPE' | 'BKASH' | 'NAGAD'), only that gateway's mapping is reset.
 * If no gateway is provided, all gateway label mappings are reset to system defaults.
 * 
 * Removes atomic keys from localStorage, updates the lookup table, updates master config,
 * and broadcasts an update event to all subscribers and tabs.
 * 
 * @param gateway Optional specific gateway to reset ('STRIPE' | 'BKASH' | 'NAGAD')
 * @returns The restored StoredLabelMappingConfig
 */
export function clearGatewayMappings(gateway?: PaymentGateway | string): StoredLabelMappingConfig {
  if (gateway !== undefined && gateway !== null && gateway !== 'ALL') {
    if (!isValidGatewayKey(gateway)) {
      throw new Error(`Invalid gateway key for clearing: "${gateway}". Expected one of: ${SUPPORTED_PAYMENT_GATEWAYS.join(', ')}`);
    }
    const normGateway = normalizeGatewayKey(gateway);
    const defaultLabel = DEFAULT_GATEWAY_MAPPINGS[normGateway] || 'Payments/Disbursed';

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`${GATEWAY_LOOKUP_STORAGE_PREFIX}${normGateway}`);
        const lookupTable = getGatewayLookupTable();
        lookupTable[normGateway] = defaultLabel;
        window.localStorage.setItem(GATEWAY_LOOKUP_TABLE_KEY, JSON.stringify(lookupTable));
      } catch (err) {
        console.warn(`Failed to clear gateway mapping for ${normGateway}:`, err);
      }
    }

    const current = getStoredMappingConfig();
    const updated: StoredLabelMappingConfig = {
      ...current,
      mappings: {
        ...current.mappings,
        [normGateway]: defaultLabel,
      },
      lastUpdated: new Date().toISOString(),
    };
    saveStoredMappingConfig(updated);
    return updated;
  }

  // Clear all gateways
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      SUPPORTED_PAYMENT_GATEWAYS.forEach((gw) => {
        window.localStorage.removeItem(`${GATEWAY_LOOKUP_STORAGE_PREFIX}${gw}`);
      });
      window.localStorage.removeItem(GATEWAY_LOOKUP_TABLE_KEY);
    } catch (err) {
      console.warn('Failed to clear gateway mappings from localStorage:', err);
    }
  }

  const resetConfig: StoredLabelMappingConfig = {
    ...DEFAULT_CONFIG,
    mappings: { ...DEFAULT_GATEWAY_MAPPINGS },
    lastUpdated: new Date().toISOString(),
  };

  saveStoredMappingConfig(resetConfig);
  return resetConfig;
}

/**
 * Dynamically fetches all user Gmail labels and retrieves message counts and color metadata
 */
export async function fetchAllGmailLabelsWithDetails(
  accessToken: string
): Promise<{
  all: DetailedGmailLabel[];
  userLabels: DetailedGmailLabel[];
  systemLabels: DetailedGmailLabel[];
}> {
  // Step 1: List all labels
  const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!listRes.ok) {
    const errText = await listRes.text();
    throw new Error(`Failed to list labels: ${listRes.status} ${errText}`);
  }

  const listData = await listRes.json();
  const rawLabels: GmailLabel[] = listData.labels || [];

  // Step 2: Fetch detailed metadata (message counts, color) for each label
  const detailedLabels: DetailedGmailLabel[] = await Promise.all(
    rawLabels.map(async (label) => {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/labels/${encodeURIComponent(label.id)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        if (detailRes.ok) {
          const detail = await detailRes.json();
          return {
            id: detail.id,
            name: detail.name,
            type: detail.type,
            messagesTotal: detail.messagesTotal ?? 0,
            messagesUnread: detail.messagesUnread ?? 0,
            color: detail.color,
            labelListVisibility: detail.labelListVisibility,
            messageListVisibility: detail.messageListVisibility,
          };
        }
      } catch {
        // Fallback to basic label info if detail fetch fails
      }
      return label;
    })
  );

  const userLabels = detailedLabels
    .filter((l) => l.type === 'user')
    .sort((a, b) => a.name.localeCompare(b.name));

  const systemLabels = detailedLabels
    .filter((l) => l.type === 'system')
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    all: detailedLabels,
    userLabels,
    systemLabels,
  };
}

/**
 * Creates a custom Gmail label / folder (supports nested paths like "Payments/bKash")
 */
export async function createCustomGmailLabel(
  accessToken: string,
  options: {
    name: string;
    textColor?: string;
    backgroundColor?: string;
  }
): Promise<DetailedGmailLabel> {
  const body: any = {
    name: options.name,
    labelListVisibility: 'labelShow',
    messageListVisibility: 'show',
  };

  if (options.textColor && options.backgroundColor) {
    body.color = {
      textColor: options.textColor,
      backgroundColor: options.backgroundColor,
    };
  }

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // If with color fails, fallback to simple creation without color
    if (body.color) {
      delete body.color;
      const fallbackRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (fallbackRes.ok) {
        return await fallbackRes.json();
      }
    }
    const errText = await res.text();
    throw new Error(`Failed to create label: ${res.status} ${errText}`);
  }

  return await res.json();
}

/**
 * Preset palette for Gmail label colors
 */
export const GMAIL_PALETTE_COLORS = [
  { name: 'Emerald Green', bg: '#16a765', text: '#ffffff' },
  { name: 'bKash Magenta', bg: '#e1147e', text: '#ffffff' },
  { name: 'Nagad Orange', bg: '#ff7537', text: '#ffffff' },
  { name: 'Stripe Indigo', bg: '#4986e7', text: '#ffffff' },
  { name: 'Purple', bg: '#b99aff', text: '#ffffff' },
  { name: 'Cyan', bg: '#2da2bb', text: '#ffffff' },
  { name: 'Rose Red', bg: '#fb4c2f', text: '#ffffff' },
  { name: 'Slate Gray', bg: '#8f8f8f', text: '#ffffff' },
];
