import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: {
    cost?: {
      throttleStatus?: {
        currentlyAvailable: number;
        restoreRate: number;
      };
    };
  };
}

export async function graphqlWithRetry<T>(
  admin: AdminApiContext,
  query: string,
  variables?: Record<string, unknown>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await admin.graphql(query, { variables });
      const json = (await response.json()) as GraphQLResponse<T>;

      if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join(", "));
      }

      const available = json.extensions?.cost?.throttleStatus?.currentlyAvailable;
      if (available !== undefined && available < 100) {
        const waitMs = Math.ceil((100 - available) / 2) * 100;
        await sleep(waitMs);
      }

      return json.data as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts - 1) {
        await sleep(2 ** attempt * 500);
      }
    }
  }

  throw lastError ?? new Error("GraphQL request failed");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
