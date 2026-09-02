/// <reference types="vite/client" />

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "virtual:runtime-entry" {
  import type { ComponentType } from "react";

  export const RuntimeApp: ComponentType;
  export function beforeRender(): void;
}
