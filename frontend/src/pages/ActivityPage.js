import React from "react";

export default function ActivityPage() {
  return (
   <div style={{ padding: 40, background: "#f1f5f9", minHeight: "100vh" }}>
    
    <div style={{ background: "white", padding: 24, borderRadius: 16 }}>
      
      <h1>Historial completo de actividad</h1>
      <p>Consulta los movimientos recientes registrados en la plataforma.</p>

      <Link
  to="/dashboard"
  style={{
    display: "inline-block",
    marginTop: 20,
    padding: "10px 16px",
    background: "#2563eb",
    color: "white",
    borderRadius: 8,
    textDecoration: "none",
    fontWeight: "600",
  }}
>
  ← Volver al dashboard
</Link>

<ul style={{ marginTop: 20 }}>
    <li>Usuario creado</li>
    <li>Ruta actualizada</li>
    <li>Tracking iniciado</li>
  </ul>

<div style={{ padding: 40, background: "#f1f5f9", minHeight: "100vh" }}></div>
<h1 style={{ fontSize: 32, fontWeight: 800 }}></h1>
<span>Vista administrativa</span>

    </div>

  </div>
  );
}