import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";
import { APP_ICON_SRC } from "./lib/assets";

export const links = () => [
  { rel: "icon", href: APP_ICON_SRC, type: "image/png" },
];

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);
  const status = isRouteError ? error.status : 500;
  const heading = isRouteError && status === 404 ? "Page not found" : "Something went wrong";
  const message =
    isRouteError && status === 404
      ? "The page you were looking for doesn't exist or may have moved."
      : "An unexpected error occurred. Please try again, or reopen the app from your Shopify admin.";

  return (
    <Document>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <img
            src={APP_ICON_SRC}
            alt="Launch Doctor"
            width={64}
            height={64}
            style={{ borderRadius: 14, marginBottom: 20 }}
          />
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{heading}</h1>
          <p style={{ color: "#616161", margin: "0 0 24px" }}>{message}</p>
          <a
            href="/app"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              background: "#1a1f2e",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Back to app
          </a>
        </div>
      </main>
    </Document>
  );
}
