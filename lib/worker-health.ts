// Latest `workerHealthy` flag from /api/state, for components that are not
// handed the workspace state (for example the photo waiting screen).
let healthy = false;
const listeners = new Set<() => void>();
export function publishWorkerHealth(value: boolean) {
  if (value === healthy) return;
  healthy = value;
  for (const listener of listeners) listener();
}
export function subscribeWorkerHealth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const workerHealthSnapshot = () => healthy;
export const workerHealthServerSnapshot = () => false;
