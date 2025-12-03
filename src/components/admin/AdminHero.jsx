import React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Hero header for admin pages.
 * Props:
 * - icon: Lucide icon component
 * - eyebrow: small uppercase text
 * - title: main title
 * - subtitle: optional description
 * - badges: array of strings or { label }
 * - gradient: background gradient override (string)
 * - iconTint: background tint for the icon container
 * - rightContent: optional React node (actions, chips)
 */
export function AdminHero({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  badges = [],
  gradient = "linear-gradient(135deg, var(--color-secondary-500), var(--color-accent-warm-400))",
  iconTint = "rgba(255,255,255,0.12)",
  rightContent,
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border shadow-lg p-6 sm:p-8"
      style={{
        background: gradient,
        color: "var(--color-text-inverse)",
        borderColor: "rgba(255,255,255,0.18)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45) 0, rgba(255,255,255,0) 40%), radial-gradient(circle at 80% 10%, rgba(255,255,255,0.25) 0, rgba(255,255,255,0) 35%)",
        }}
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: iconTint, border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <Icon className="w-6 h-6" />
              </div>
            )}
            <div>
              {eyebrow && <p className="text-xs uppercase tracking-[0.2em] text-white/80">{eyebrow}</p>}
              <h2 className="text-2xl sm:text-3xl font-bold">{title}</h2>
              {subtitle && <p className="text-sm text-white/80">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2">
            {badges.map((b, idx) => {
              const label = typeof b === "string" ? b : b?.label;
              return (
                <Badge key={idx} className="bg-white/15 text-white border border-white/25">
                  {label}
                </Badge>
              );
            })}
            {rightContent}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Panel wrapper to keep consistent borders/shadows.
 * Accepts title, icon, children, className, headerClassName, contentClassName.
 */
export function AdminPanel({
  icon: Icon,
  title,
  children,
  className = "",
  headerClassName = "",
  contentClassName = "",
  accent = "primary",
}) {
  const accentMap = {
    primary: "var(--color-primary-500)",
    secondary: "var(--color-secondary-500)",
    olive: "var(--color-accent-olive-500)",
  };
  const accentColor = accentMap[accent] || "var(--color-primary-500)";

  return (
    <div
      className={`rounded-xl border shadow-sm bg-white ${className}`}
      style={{ borderColor: "var(--color-border-light)" }}
    >
      <div
        className={`border-b px-4 py-3 ${headerClassName}`}
        style={{ borderColor: "var(--color-border-light)" }}
      >
        <div className="flex items-center gap-2 text-lg" style={{ color: "var(--color-text-primary)" }}>
          {Icon && <Icon className="w-5 h-5" style={{ color: accentColor }} />}
          <span className="font-semibold">{title}</span>
        </div>
      </div>
      <div className={`p-4 ${contentClassName}`}>{children}</div>
    </div>
  );
}
