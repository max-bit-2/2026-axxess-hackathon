/** Medivance design tokens – exact values from globals.css */

export const colors = {
  ice: "#75b6d1",
  ocean: "#4f86b5",
  silver: "#bbbbbd",
  cloud: "#d6d6d7",
  mist: "#a6b8cf",
  inkStrong: "#1d3048",
  inkSoft: "#4a5d75",
  glassBg: "rgba(255,255,255,0.26)",
  glassBorder: "rgba(255,255,255,0.48)",
  checkPass: "rgba(22,163,74,0.15)",
  checkPassText: "#166534",
  checkFail: "rgba(220,38,38,0.16)",
  checkFailText: "#991b1b",
  checkWarn: "rgba(217,119,6,0.16)",
  checkWarnText: "#92400e",
  white30: "rgba(255,255,255,0.30)",
  white42: "rgba(255,255,255,0.42)",
  white60: "rgba(255,255,255,0.60)",
  white25: "rgba(255,255,255,0.25)",
  white28: "rgba(255,255,255,0.28)",
  white64: "rgba(255,255,255,0.64)",
} as const;

export const background =
  "linear-gradient(130deg, #d9e4ed 0%, #d5d9dc 52%, #b8cadf 100%)";

export const glassPanel: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(255,255,255,0.42), rgba(210,223,234,0.24))",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: 28,
  border: `1px solid ${colors.white60}`,
  padding: 20,
  boxShadow: "0 18px 45px -28px rgba(10,36,72,0.42)",
};

export const pillBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 9999,
  border: "1px solid rgba(255,255,255,0.72)",
  background: "linear-gradient(160deg, rgba(79,134,181,0.94), rgba(117,182,209,0.88))",
  color: "#f8fbff",
  fontWeight: 600,
  letterSpacing: "0.01em",
  padding: "10px 18px",
  fontSize: 14,
  boxShadow: "0 16px 32px -22px rgba(16,54,97,0.95)",
};

export const pillBtnDanger: React.CSSProperties = {
  ...pillBtn,
  background: "linear-gradient(170deg, rgba(245,134,144,0.84), rgba(213,69,90,0.85))",
  color: "#fff",
};

export const statLabel: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.12em",
  color: colors.inkSoft,
  fontWeight: 700,
  textTransform: "uppercase" as const,
};

export const statValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 600,
  color: colors.inkStrong,
};

export const summaryLabel: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  color: colors.inkSoft,
  fontWeight: 700,
};

export const summaryValue: React.CSSProperties = {
  color: colors.inkStrong,
  fontSize: 16,
  fontWeight: 600,
};

export const summarySub: React.CSSProperties = {
  color: "#5f7087",
  fontSize: 13,
};

export const queueRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: 12,
  borderRadius: 24,
  border: `1px solid ${colors.white64}`,
  background: colors.white28,
  padding: "14px 16px",
};

export const checkRow: React.CSSProperties = {
  borderRadius: 16,
  border: `1px solid rgba(255,255,255,0.62)`,
  background: "rgba(255,255,255,0.27)",
  padding: "12px 14px",
  display: "grid",
  gap: 3,
};

export const logoMark: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 9999,
  background:
    "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), rgba(255,255,255,0) 42%), linear-gradient(145deg, #4f86b5, #75b6d1)",
  boxShadow:
    "inset 0 1px 2px rgba(255,255,255,0.55), 0 12px 24px -14px rgba(11,55,103,0.88)",
};
