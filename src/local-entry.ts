import App from "./App";
import { installWebMcpShim, shimRequested } from "./webmcp/shim";

export const RuntimeApp = App;

export function beforeRender() {
  // Install the local host before React mounts, so the app's registration finds it.
  if (shimRequested()) installWebMcpShim();
}
