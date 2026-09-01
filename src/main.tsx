import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter/wght-italic.css";
import App from "./App";
import { installWebMcpShim, shimRequested } from "./webmcp/shim";
import "./styles.css";

// Install the local host before React mounts, so the app's registration finds it.
if (shimRequested()) installWebMcpShim();

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
