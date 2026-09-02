import { LandingPage } from "./LandingPage";

export function HeroExperimentPage({ configured }: { configured: boolean }) {
  return <LandingPage configured={configured} />;
}
