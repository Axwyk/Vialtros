import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import reportWebVitals from "./reportWebVitals";

// Limpiar todos los service workers y caches obsoletos antes de renderizar
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

// Suprimir errores de extensiones de Chrome que cierran canales de mensajes
// antes de completar su respuesta asíncrona. No es un error de la app.
const _SW_MSG_ERR = "message channel closed before a response was received";
window.addEventListener("unhandledrejection", (event) => {
  const msg =
    event.reason?.message ?? (typeof event.reason === "string" ? event.reason : "");
  if (msg.includes(_SW_MSG_ERR)) {
    event.preventDefault();
  }
});
window.addEventListener("error", (event) => {
  if (event.message?.includes(_SW_MSG_ERR)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
});
const _origConsoleError = console.error.bind(console);
console.error = (...args) => {
  const msg = typeof args[0] === "string" ? args[0] : args[0]?.message ?? "";
  if (msg.includes(_SW_MSG_ERR)) return;
  _origConsoleError(...args);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.unregister();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
