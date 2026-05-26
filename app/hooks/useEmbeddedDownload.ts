import { useAppBridge } from "@shopify/app-bridge-react";
import { useCallback, useState } from "react";

export function useEmbeddedDownload() {
  const shopify = useAppBridge();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(
    async (path: string, filename: string) => {
      setDownloading(true);
      setError(null);

      try {
        const token = await shopify.idToken();
        const response = await fetch(path, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Download failed (${response.status})`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Download failed. Please try again.";
        setError(message);
      } finally {
        setDownloading(false);
      }
    },
    [shopify],
  );

  return { download, downloading, error, clearError: () => setError(null) };
}
