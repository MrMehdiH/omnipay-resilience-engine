import { create } from "zustand";
import {
  EcosystemConfig,
  EcosystemId,
  ECOSYSTEM_CONFIGS,
} from "@/schemas/ecosystem";

interface EcosystemState {
  currentEcosystem: EcosystemId;
  config: EcosystemConfig;
  xRayMode: boolean;
  vpnWarningActive: boolean;
  
  // Actions
  setEcosystem: (id: EcosystemId) => void;
  toggleEcosystem: () => void;
  toggleXRayMode: () => void;
  setXRayMode: (enabled: boolean) => void;
  dismissVpnWarning: () => void;
  triggerVpnSimulation: () => void;
}

function syncDocumentAttributes(ecosystemId: EcosystemId, xRay: boolean) {
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

  setEcosystem: (id: EcosystemId) => {
    const nextConfig = ECOSYSTEM_CONFIGS[id];
    const isIran = id === "IRAN_SHAPARAK";
    const xRay = get().xRayMode;

    syncDocumentAttributes(id, xRay);

    set({
      currentEcosystem: id,
      config: nextConfig,
      vpnWarningActive: isIran, // Simulate VPN check for Iran IPG
    });
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
    set({ vpnWarningActive: false });
  },

  triggerVpnSimulation: () => {
    if (get().currentEcosystem === "IRAN_SHAPARAK") {
      set({ vpnWarningActive: true });
    }
  },
}));
