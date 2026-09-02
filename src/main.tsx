import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/inter/wght-italic.css";
import "./styles.css";
import { startThermalChartMotion } from "./charts/motion";
import { RuntimeApp, beforeRender } from "virtual:runtime-entry";

beforeRender();
startThermalChartMotion();
const container = document.getElementById("root")!;
container.replaceChildren();
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <RuntimeApp />
  </React.StrictMode>,
);
