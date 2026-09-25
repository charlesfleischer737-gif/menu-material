// Job times come from the server's clock, and a device's clock can be minutes
// off, so /api/state reports the server's time and elapsed times use that.
let offset = 0;
export function syncServerClock(serverTime: unknown, received = Date.now()) {
  if (typeof serverTime === "number" && Number.isFinite(serverTime))
    offset = serverTime - received;
}
export const serverNow = () => Date.now() + offset;
