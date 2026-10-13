import assets from "./landing-assets.json";
import type { Moment } from "./landing-demo";

// The build renders these immutable samples with the same bundled-font renderer
// used for print previews. The landing needs their images and dimensions only.
export const landingHero = assets.hero;
export function createMoments(): Moment[] {
  return assets.moments as Moment[];
}
