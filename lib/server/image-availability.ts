import { config } from "./core";
import { budgetStatus } from "./monitoring";

/**
 * Whether a new image can be made now, so the guest studio can say so before
 * anyone signs up for one: an OpenAI key, AI work not paused, and room in
 * today's site-wide budget. Guests and Free plans also need room in the share
 * of it they use together; paid plans can use the rest. Only this yes or no
 * leaves the server, never spend figures.
 */
export async function imagesAvailable(paid = false) {
  if (!config("OPENAI_API_KEY")) return false;
  const budget = await budgetStatus();
  if (budget.status === "paused" || budget.status === "exhausted") return false;
  return paid || !budget.freeShareUsedUp;
}
