import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/** Liveness probe for Fly.io / load balancers. No auth, no DB. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  return json({ ok: true, service: "launch-doctor" }, { status: 200 });
};
