import type { ReactNode } from "react";
import { useNavigate } from "@remix-run/react";
import { Page, type PageProps } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { shopifyAppPath } from "../lib/app-routes";

type AppPageProps = Omit<PageProps, "backAction"> & {
  title: string;
  shopDomain: string;
  backTo?: string;
  backLabel?: string;
  titleBarChildren?: ReactNode;
  children: ReactNode;
};

export function AppPage({
  title,
  shopDomain,
  backTo = "/app",
  backLabel = "Dashboard",
  titleBarChildren,
  children,
  ...pageProps
}: AppPageProps) {
  const navigate = useNavigate();

  const goBack = () => navigate(shopifyAppPath(backTo, shopDomain));

  return (
    <>
      <TitleBar title={title}>
        <button variant="breadcrumb" onClick={goBack}>
          {backLabel}
        </button>
        {titleBarChildren}
      </TitleBar>
      <Page
        {...pageProps}
        backAction={{
          content: backLabel,
          onAction: goBack,
        }}
      >
        {children}
      </Page>
    </>
  );
}
