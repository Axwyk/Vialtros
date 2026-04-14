import React from "react";
import { Link } from "react-router-dom";
import "./TrackingHero.css";

export default function TrackingHero({
  backTo = "/dashboard",
  backAriaLabel = "Volver al dashboard",
  eyebrow = "Sistema activo",
  title,
  description,
  subtitle,
  meta = null,
}) {
  return (
    <section className="tracking-hero-shell">
      <div
        className="tracking-hero-orb tracking-hero-orb-primary"
        aria-hidden="true"
      />
      <div
        className="tracking-hero-orb tracking-hero-orb-secondary"
        aria-hidden="true"
      />

      <div className="tracking-hero-content">
        <div className="tracking-hero-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={backTo}
              className="tracking-hero-back"
              aria-label={backAriaLabel}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </Link>

            <div className="tracking-hero-status-wrap">
              <span className="tracking-hero-live-dot" aria-hidden="true">
                <span className="tracking-hero-live-dot-ping" />
                <span className="tracking-hero-live-dot-core" />
              </span>
              <span className="tracking-hero-status-label">{eyebrow}</span>
            </div>
          </div>

          {meta ? <div className="tracking-hero-meta">{meta}</div> : null}
        </div>

        <div className="tracking-hero-copy">
          <h1 className="tracking-hero-title">{title}</h1>
          {description ? (
            <p className="tracking-hero-description">{description}</p>
          ) : null}
          {subtitle ? (
            <p className="tracking-hero-subtitle">{subtitle}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
