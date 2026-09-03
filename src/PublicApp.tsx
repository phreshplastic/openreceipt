import { lazy, Suspense } from "react";
import { LandingPage } from "./pages/LandingPage";
const DemoEditorPage = lazy(() => import("./pages/DemoEditorPage"));
const GuidesPage = lazy(() => import("./pages/GuidesPage").then((module) => ({ default: module.GuidesPage })));
const GuidePage = lazy(() => import("./pages/GuidesPage").then((module) => ({ default: module.GuidePage })));
// WebMCP is the point of the site, so it registers on the pages a person can land on.
// It stays a separate chunk: the tools load after the page, never in front of it.
const PublicAgentTools = lazy(() => import("./webmcp/PublicAgentTools"));
const publicFallback = <main className="private-public-shell"><div><h1>Opening…</h1></div></main>;

export function PublicApp() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/app") return <Suspense fallback={publicFallback}><DemoEditorPage /></Suspense>;
  if (path === "/guides") return <Suspense fallback={publicFallback}><GuidesPage /></Suspense>;
  if (path.startsWith("/guides/")) return <Suspense fallback={publicFallback}><GuidePage slug={decodeURIComponent(path.slice("/guides/".length))} /></Suspense>;
  return <>
    <LandingPage />
    <Suspense fallback={null}><PublicAgentTools /></Suspense>
  </>;
}
