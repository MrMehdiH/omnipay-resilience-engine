import { create } from "zustand";
import {
  EcosystemConfig,
  EcosystemId,
  ECOSYSTEM_CONFIGS,
} from "@/schemas/ecosystem";
import {
  ChaosConfig,
  DagNodeId,
  DagNodeState,
  SettlementResult,
  TelemetryEvent,
  TransactionPayload,
  RetryPolicy,
} from "@/schemas/transaction.schema";
import {
  TransactionDag,
  ChaosGatewaySimulator,
  InMemoryCartLock,
  InMemoryOptimisticLedger,
  realTimeScheduler,
} from "@/core/dag/transaction-dag";
import { IdempotencyRegistry } from "@/core/dag/idempotency-engine";

export const INITIAL_DAG_NODES: Record<DagNodeId, DagNodeState> = {
  CART_LOCK: {
    nodeId: "CART_LOCK",
    status: "PENDING",
    visits: 0,
    enteredAt: null,
    exitedAt: null,
    lastError: null,
  },
  IDEMPOTENCY: {
    nodeId: "IDEMPOTENCY",
    status: "PENDING",
    visits: 0,
    enteredAt: null,
    exitedAt: null,
    lastError: null,
  },
  OPTIMISTIC: {
    nodeId: "OPTIMISTIC",
    status: "PENDING",
    visits: 0,
    enteredAt: null,
    exitedAt: null,
    lastError: null,
  },
  GATEWAY: {
    nodeId: "GATEWAY",
    status: "PENDING",
    visits: 0,
    enteredAt: null,
    exitedAt: null,
    lastError: null,
  },
  RETRY_BACKOFF: {
    nodeId: "RETRY_BACKOFF",
    status: "PENDING",
    visits: 0,
    enteredAt: null,
    exitedAt: null,
    lastError: null,
  },
  DLQ_OR_COMMIT: {
    nodeId: "DLQ_OR_COMMIT",
    status: "PENDING",
    visits: 0,
    enteredAt: null,
    exitedAt: null,
    lastError: null,
  },
};

export const DEFAULT_CHAOS_CONFIG: ChaosConfig = {
  enabled: true,
  seed: 1337,
  latency: {
    baseMs: 120,
    jitterMs: 80,
  },
  gatewayTimeoutMs: 5000,
  gatewayFailureRate: 0.15,
  hardDeclineRatio: 0.3,
  networkPartition: false,
  vpnDetected: false,
  smsOtpLatencyMs: 350,
};

export type ChaosPreset =
  | "baseline"
  | "highLatency"
  | "networkPartition"
  | "retryStorm"
  | "hardDecline"
  | "vpnGeoBlock";

export const CHAOS_PRESETS: Record<ChaosPreset, Partial<ChaosConfig>> = {
  baseline: {
    enabled: true,
    latency: { baseMs: 45, jitterMs: 20 },
    gatewayTimeoutMs: 5000,
    gatewayFailureRate: 0,
    hardDeclineRatio: 0,
    networkPartition: false,
    vpnDetected: false,
    smsOtpLatencyMs: 0,
  },
  highLatency: {
    enabled: true,
    latency: { baseMs: 3200, jitterMs: 1800 },
    gatewayTimeoutMs: 4500,
    gatewayFailureRate: 0.1,
    hardDeclineRatio: 0,
    networkPartition: false,
    smsOtpLatencyMs: 3000,
  },
  networkPartition: {
    enabled: true,
    latency: { baseMs: 500, jitterMs: 100 },
    gatewayTimeoutMs: 3000,
    gatewayFailureRate: 1.0,
    hardDeclineRatio: 0,
    networkPartition: true,
    vpnDetected: false,
  },
  retryStorm: {
    enabled: true,
    latency: { baseMs: 180, jitterMs: 100 },
    gatewayTimeoutMs: 6000,
    gatewayFailureRate: 0.7,
    hardDeclineRatio: 0,
    networkPartition: false,
    vpnDetected: false,
  },
  hardDecline: {
    enabled: true,
    latency: { baseMs: 120, jitterMs: 60 },
    gatewayTimeoutMs: 5000,
    gatewayFailureRate: 1.0,
    hardDeclineRatio: 1.0,
    networkPartition: false,
    vpnDetected: false,
  },
  vpnGeoBlock: {
    enabled: true,
    latency: { baseMs: 150, jitterMs: 50 },
    gatewayTimeoutMs: 5000,
    gatewayFailureRate: 0,
    hardDeclineRatio: 0,
    networkPartition: false,
    vpnDetected: true,
  },
};

// Module-level singletons to persist registry across UI executions
const sharedRegistry = new IdempotencyRegistry<SettlementResult>();
const sharedCartLock = new InMemoryCartLock();
const sharedLedger = new InMemoryOptimisticLedger();

export interface SimulationOptions {
  forceReplay?: boolean;
  forceConflict?: boolean;
}

export interface EcosystemState {
  currentEcosystem: EcosystemId;
  config: EcosystemConfig;
  xRayMode: boolean;
  vpnWarningActive: boolean;

  // Chaos Engine State
  chaosConfig: ChaosConfig;
  setChaosConfig: (config: ChaosConfig | ((prev: ChaosConfig) => ChaosConfig)) => void;
  updateChaosConfig: (patch: Partial<ChaosConfig>) => void;
  resetChaosConfig: () => void;
  applyChaosPreset: (presetKey: ChaosPreset) => void;

  // DAG & Telemetry State
  dagNodes: Record<DagNodeId, DagNodeState>;
  telemetryEvents: TelemetryEvent[];
  activeTransactionId: string | null;
  lastTransactionPayload: TransactionPayload | null;
  lastSettlementResult: SettlementResult | null;
  isSimulating: boolean;

  // Ecosystem Actions
  setEcosystem: (id: EcosystemId) => void;
  toggleEcosystem: () => void;
  toggleXRayMode: () => void;
  setXRayMode: (enabled: boolean) => void;
  dismissVpnWarning: () => void;
  triggerVpnSimulation: () => void;

  // DAG Actions
  setDagNodeState: (nodeId: DagNodeId, patch: Partial<DagNodeState>) => void;
  addTelemetryEvent: (event: TelemetryEvent) => void;
  clearTelemetry: () => void;
  resetDagNodes: () => void;
  executeSimulation: (options?: SimulationOptions) => Promise<SettlementResult>;
}

function syncDocumentAttributes(ecosystemId: EcosystemId, xRay: boolean): void {
  if (typeof document === "undefined") return;
  const config = ECOSYSTEM_CONFIGS[ecosystemId];
  const root = document.documentElement;

  root.setAttribute("lang", config.locale);
  root.setAttribute("dir", config.direction);
  root.setAttribute("data-ecosystem", ecosystemId);
  root.setAttribute("data-xray", String(xRay));
}

export const useEcosystemStore = create<EcosystemState>((set, get) => ({
  currentEcosystem: "GLOBAL_STRIPE",
  config: ECOSYSTEM_CONFIGS.GLOBAL_STRIPE,
  xRayMode: false,
  vpnWarningActive: false,

  chaosConfig: DEFAULT_CHAOS_CONFIG,
  dagNodes: INITIAL_DAG_NODES,
  telemetryEvents: [],
  activeTransactionId: null,
  lastTransactionPayload: null,
  lastSettlementResult: null,
  isSimulating: false,

  setEcosystem: (id: EcosystemId) => {
    const nextConfig = ECOSYSTEM_CONFIGS[id];
    const isIran = id === "IRAN_SHAPARAK";
    const xRay = get().xRayMode;

    syncDocumentAttributes(id, xRay);

    set((state) => ({
      currentEcosystem: id,
      config: nextConfig,
      vpnWarningActive: isIran,
      chaosConfig: {
        ...state.chaosConfig,
        vpnDetected: isIran,
      },
    }));
  },

  toggleEcosystem: () => {
    const nextId: EcosystemId =
      get().currentEcosystem === "GLOBAL_STRIPE"
        ? "IRAN_SHAPARAK"
        : "GLOBAL_STRIPE";
    get().setEcosystem(nextId);
  },

  toggleXRayMode: () => {
    const next = !get().xRayMode;
    syncDocumentAttributes(get().currentEcosystem, next);
    set({ xRayMode: next });
  },

  setXRayMode: (enabled: boolean) => {
    syncDocumentAttributes(get().currentEcosystem, enabled);
    set({ xRayMode: enabled });
  },

  dismissVpnWarning: () => {
    set((state) => ({
      vpnWarningActive: false,
      chaosConfig: {
        ...state.chaosConfig,
        vpnDetected: false,
      },
    }));
  },

  triggerVpnSimulation: () => {
    if (get().currentEcosystem === "IRAN_SHAPARAK") {
      set((state) => ({
        vpnWarningActive: true,
        chaosConfig: {
          ...state.chaosConfig,
          vpnDetected: true,
        },
      }));
    }
  },

  setChaosConfig: (configOrUpdater) => {
    set((state) => {
      const nextConfig =
        typeof configOrUpdater === "function"
          ? configOrUpdater(state.chaosConfig)
          : configOrUpdater;

      const isIran = state.currentEcosystem === "IRAN_SHAPARAK";
      return {
        chaosConfig: nextConfig,
        vpnWarningActive: isIran ? nextConfig.vpnDetected : false,
      };
    });
  },

  updateChaosConfig: (patch: Partial<ChaosConfig>) => {
    set((state) => {
      const updated: ChaosConfig = {
        ...state.chaosConfig,
        ...patch,
        latency: {
          ...state.chaosConfig.latency,
          ...(patch.latency ?? {}),
        },
      };

      const isIran = state.currentEcosystem === "IRAN_SHAPARAK";
      const vpnActive =
        patch.vpnDetected !== undefined
          ? isIran && patch.vpnDetected
          : state.vpnWarningActive;

      return {
        chaosConfig: updated,
        vpnWarningActive: vpnActive,
      };
    });
  },

  resetChaosConfig: () => {
    const isIran = get().currentEcosystem === "IRAN_SHAPARAK";
    set({
      chaosConfig: {
        ...DEFAULT_CHAOS_CONFIG,
        vpnDetected: isIran,
      },
      vpnWarningActive: isIran,
    });
  },

  applyChaosPreset: (presetKey: ChaosPreset) => {
    const patch = CHAOS_PRESETS[presetKey];
    get().updateChaosConfig(patch);
  },

  setDagNodeState: (nodeId: DagNodeId, patch: Partial<DagNodeState>) => {
    set((state) => ({
      dagNodes: {
        ...state.dagNodes,
        [nodeId]: {
          ...state.dagNodes[nodeId],
          ...patch,
        },
      },
    }));
  },

  addTelemetryEvent: (event: TelemetryEvent) => {
    set((state) => ({
      telemetryEvents: [event, ...state.telemetryEvents].slice(0, 50),
    }));
  },

  clearTelemetry: () => {
    set({ telemetryEvents: [] });
  },

  resetDagNodes: () => {
    set({
      dagNodes: INITIAL_DAG_NODES,
      lastSettlementResult: null,
    });
  },

  executeSimulation: async (options?: SimulationOptions): Promise<SettlementResult> => {
    const current = get();
    if (current.isSimulating) {
      throw new Error("A simulation is already in progress.");
    }

    set({ isSimulating: true, lastSettlementResult: null });
    get().resetDagNodes();

    const isIran = current.currentEcosystem === "IRAN_SHAPARAK";
    let payload: TransactionPayload;

    if (options?.forceReplay && current.lastTransactionPayload) {
      payload = current.lastTransactionPayload;
    } else if (options?.forceConflict && current.lastTransactionPayload) {
      payload = {
        ...current.lastTransactionPayload,
        amountMinor: current.lastTransactionPayload.amountMinor + 1000,
      } as TransactionPayload;
    } else {
      const txId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `10000000-2000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;
      const idempKey = `intent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      payload = isIran
        ? {
            ecosystem: "IRAN_SHAPARAK",
            currency: "IRT",
            rail: "SHAPARAK_SAMAN",
            mobile: "09121234567",
            callbackUrl: "https://omnipay.io/ipg/callback",
            transactionId: txId,
            idempotencyKey: idempKey,
            cartId: `cart_${txId.slice(0, 8)}`,
            customerId: "cust_iran_99",
            amountMinor: 450000,
            createdAt: Date.now(),
          }
        : {
            ecosystem: "GLOBAL_STRIPE",
            currency: "USD",
            rail: "STRIPE_CARD",
            region: "us-east-1",
            transactionId: txId,
            idempotencyKey: idempKey,
            cartId: `cart_${txId.slice(0, 8)}`,
            customerId: "cust_global_99",
            amountMinor: 4500,
            createdAt: Date.now(),
          };
    }

    set({
      activeTransactionId: payload.transactionId,
      lastTransactionPayload: payload,
    });

    const chaos = get().chaosConfig;
    const gateway = new ChaosGatewaySimulator(chaos, realTimeScheduler);
    const retryPolicy: RetryPolicy = {
      maxAttempts: 3,
      baseDelayMs: 250,
      maxDelayMs: 2000,
    };

    const dag = new TransactionDag({
      gateway,
      ledger: sharedLedger,
      cartLock: sharedCartLock,
      registry: sharedRegistry,
      retryPolicy,
      vpnDetected: () => get().chaosConfig.vpnDetected,
    });

    const unsubscribe = dag.subscribe((event: TelemetryEvent) => {
      get().addTelemetryEvent(event);
      if (event.type === "NODE_ENTERED") {
        get().setDagNodeState(event.nodeId, {
          status: "ACTIVE",
          enteredAt: event.timestamp,
          visits: event.attempt,
        });
      } else if (event.type === "NODE_EXITED") {
        get().setDagNodeState(event.nodeId, {
          status: event.status,
          exitedAt: event.timestamp,
        });
      } else if (event.type === "IDEMPOTENCY_REPLAY") {
        get().setDagNodeState("IDEMPOTENCY", {
          status: "SKIPPED",
        });
      }
    });

    try {
      const result = await dag.execute(payload);
      set((s) => ({
        dagNodes: { ...s.dagNodes, ...result.nodes },
        lastSettlementResult: result,
        isSimulating: false,
      }));
      unsubscribe();
      return result;
    } catch (error: unknown) {
      unsubscribe();
      set({ isSimulating: false });
      throw error;
    }
  },
}));
