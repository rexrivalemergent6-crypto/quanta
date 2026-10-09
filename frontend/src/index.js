import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

window.Buffer = window.Buffer || Buffer;
window.global = window.global || window;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
