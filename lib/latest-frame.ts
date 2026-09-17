// Keep only the latest input for the next animation frame. Clearing also
// invalidates a callback that was already handed to the browser scheduler.
export function latestFrame<T>(
  render: (value: T) => void,
  request: (callback: FrameRequestCallback) => number = (callback) =>
    requestAnimationFrame(callback),
  cancel: (id: number) => void = (id) => cancelAnimationFrame(id),
) {
  let pending: number | null = null;
  let value: T | undefined;
  let revision = 0;
  return {
    push(next: T) {
      value = next;
      if (pending !== null) return;
      const ticket = ++revision;
      pending = request(() => {
        if (ticket !== revision) return;
        pending = null;
        const current = value;
        value = undefined;
        if (current !== undefined) render(current);
      });
    },
    clear() {
      revision++;
      if (pending !== null) cancel(pending);
      pending = null;
      value = undefined;
    },
  };
}
