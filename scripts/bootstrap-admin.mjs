const email = process.argv[2];
if (!email || !process.env.ADMIN_SETUP_KEY)
  throw Error(
    "Usage: ADMIN_SETUP_KEY=<secret> APP_ORIGIN=<url> node scripts/bootstrap-admin.mjs <your-email>",
  );
const origin = process.env.APP_ORIGIN || "http://127.0.0.1:5173";
const r = await fetch(new URL("/api/auth/bootstrap", origin), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, setupKey: process.env.ADMIN_SETUP_KEY }),
});
const d = await r.json();
if (!r.ok) throw Error(d.error);
console.log(
  "Private admin invitation (valid for 7 days):\n" + new URL(d.path, origin),
);
