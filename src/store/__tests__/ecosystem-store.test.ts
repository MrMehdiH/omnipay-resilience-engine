import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { useEcosystemStore, DEFAULT_CHAOS_CONFIG } from '../useEcosystemStore';

const initial = useEcosystemStore.getInitialState();
const store = () => useEcosystemStore.getState();

beforeEach(() => {
  useEcosystemStore.setState(initial, true);
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); });

async function run(options?: Parameters<ReturnType<typeof store>['executeSimulation']>[0]) {
  const result = store().executeSimulation(options).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const settled = await result;
  if (!settled.ok) throw settled.error;
  return settled.value;
}

describe('simulation boundaries', () => {
  it('rejects invalid config before it can corrupt store state', () => {
    expect(() => store().updateChaosConfig({ gatewayFailureRate: 2 })).toThrow(ZodError);
    expect(store().chaosConfig).toEqual(DEFAULT_CHAOS_CONFIG);
  });

  it('applies a preset independently of the previously active VPN and OTP settings', () => {
    store().applyChaosPreset('vpnGeoBlock');
    store().updateChaosConfig({ smsOtpLatencyMs: 250000 });
    store().applyChaosPreset('highLatency');
    const first = store().chaosConfig;
    store().resetChaosConfig();
    store().applyChaosPreset('highLatency');
    expect(store().chaosConfig).toEqual(first);
    expect(first.vpnDetected).toBe(false);
  });

  it('starts an Iranian session without pretending VPN has been detected', () => {
    store().setEcosystem('IRAN_SHAPARAK');
    expect(store().chaosConfig.vpnDetected).toBe(false);
    expect(store().vpnWarningActive).toBe(false);
  });

  it('clears the previous intent and result when changing ecosystem', async () => {
    store().applyChaosPreset('baseline');
    await run();
    store().setEcosystem('IRAN_SHAPARAK');
    expect(store().lastTransactionPayload).toBeNull();
    expect(store().lastSettlementResult).toBeNull();
    expect(store().telemetryEvents).toEqual([]);
    expect((await run({ forceReplay: true })).ecosystem).toBe('IRAN_SHAPARAK');
  });

  it('keeps the active ecosystem stable until the pending run finishes', async () => {
    store().applyChaosPreset('baseline');
    const pending = store().executeSimulation();
    store().setEcosystem('IRAN_SHAPARAK');
    expect(store().currentEcosystem).toBe('GLOBAL_STRIPE');
    await vi.runAllTimersAsync();
    await pending;
  });

  it('shows failures and preserves the original payload after a conflict', async () => {
    store().applyChaosPreset('baseline');
    await run();
    const payload = store().lastTransactionPayload;
    await expect(run({ forceConflict: true })).rejects.toThrow(/different payload/);
    expect(store().lastTransactionPayload).toEqual(payload);
    expect(store()).toHaveProperty('lastSimulationError', expect.any(String));
    expect(store().isSimulating).toBe(false);
    expect((await run({ forceReplay: true })).outcome).toBe('COMMITTED');
    expect(store().dagNodes.GATEWAY.visits).toBe(0);
    expect(store().dagNodes.GATEWAY.status).toBe('SKIPPED');
  });

  it('separates dismissing the VPN notice from turning off the simulated fault', () => {
    store().setEcosystem('IRAN_SHAPARAK');
    store().triggerVpnSimulation();
    store().dismissVpnWarning();
    expect(store().vpnWarningActive).toBe(false);
    expect(store().chaosConfig.vpnDetected).toBe(true);
  });
});
