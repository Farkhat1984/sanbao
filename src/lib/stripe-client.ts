/**
 * Shared Stripe client factory.
 * Returns null when STRIPE_SECRET_KEY is not configured (graceful degradation).
 */
import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@/lib/constants";

let cachedStripe: Stripe | null = null;

/** Returns a Stripe client, or null if STRIPE_SECRET_KEY is not set. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!cachedStripe) {
    cachedStripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION });
  }
  return cachedStripe;
}
