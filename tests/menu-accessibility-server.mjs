// Local-only browser harness. This is not a production application route.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({
  configFile: false,
  root,
  plugins: [react()],
  resolve: { alias: { "@": root } },
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
await server.listen();
console.log(
  "Menu accessibility fixtures: http://127.0.0.1:5174/tests/menu-accessibility.html",
);
process.once("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
process.once("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});
