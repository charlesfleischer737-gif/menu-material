import { siteOrigin } from "../site-metadata";
import { llmsText } from "@/lib/llms-text";

// A plain-text map of the public site for AI assistants (lib/llms-text.ts).
export const dynamic = "force-dynamic";
export async function GET() {
  return new Response(llmsText(await siteOrigin()), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
