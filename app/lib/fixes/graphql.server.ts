import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export function parseGraphqlErrors(json: {
  errors?: Array<{ message: string }>;
  data?: Record<string, unknown>;
}): string | null {
  if (json.errors?.length) {
    return json.errors.map((e) => e.message).join(", ");
  }

  for (const value of Object.values(json.data ?? {})) {
    if (!value || typeof value !== "object") continue;

    const record = value as Record<string, unknown>;
    const userErrors =
      (record.userErrors as Array<{ message: string }> | undefined) ??
      (record.mediaUserErrors as Array<{ message: string }> | undefined);

    if (userErrors?.length) {
      return userErrors.map((e) => e.message).join(", ");
    }
  }

  return null;
}

export async function adminGraphql<T>(
  admin: AdminApiContext,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await admin.graphql(query, { variables });
  const json = (await response.json()) as {
    errors?: Array<{ message: string }>;
    data?: Record<string, unknown>;
  };
  const error = parseGraphqlErrors(json);
  if (error) {
    throw new Error(error);
  }
  return json.data as T;
}
