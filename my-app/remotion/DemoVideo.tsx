import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Easing,
} from "remotion";
import * as S from "./styles";

/* ------------------------------------------------------------------ */
/*  Shared tiny components                                             */
/* ------------------------------------------------------------------ */

const LogoMark: React.FC = () => <div style={S.logoMark} />;

const StatusPill: React.FC<{
  label: string;
  bg: string;
  text: string;
  border: string;
}> = ({ label, bg, text, border }) => (
  <span
    style={{
      borderRadius: 9999,
      border: `1px solid ${border}`,
      background: bg,
      color: text,
      fontSize: 12,
      fontWeight: 600,
      padding: "3px 12px",
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);

const CheckBadge: React.FC<{ status: "PASS" | "FAIL" | "WARN" }> = ({
  status,
}) => {
  const map = {
    PASS: { bg: S.colors.checkPass, color: S.colors.checkPassText },
    FAIL: { bg: S.colors.checkFail, color: S.colors.checkFailText },
    WARN: { bg: S.colors.checkWarn, color: S.colors.checkWarnText },
  };
  return (
    <span
      style={{
        borderRadius: 9999,
        padding: "2px 10px",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontWeight: 700,
        background: map[status].bg,
        color: map[status].color,
      }}
    >
      {status}
    </span>
  );
};

const GlassCard: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div style={{ ...S.glassPanel, ...style }}>{children}</div>
);

/* ------------------------------------------------------------------ */
/*  Header bar (shared across scenes)                                  */
/* ------------------------------------------------------------------ */

const Header: React.FC = () => (
  <div
    style={{
      ...S.glassPanel,
      borderRadius: 20,
      padding: "10px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "absolute",
      top: 28,
      left: 48,
      right: 48,
      zIndex: 10,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoMark />
      <span
        style={{
          fontWeight: 700,
          fontSize: 18,
          color: S.colors.inkStrong,
          letterSpacing: "-0.01em",
        }}
      >
        Medivance
      </span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 13, color: S.colors.inkSoft, fontWeight: 500 }}>
        Dashboard
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: S.colors.inkStrong,
        }}
      >
        Chris Martinez, PharmD
      </span>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Floating orbs background                                           */
/* ------------------------------------------------------------------ */

const OrbBg: React.FC = () => {
  const frame = useCurrentFrame();
  const y = Math.sin(frame / 30) * 10;
  return (
    <>
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: 9999,
          background:
            "radial-gradient(circle at center, rgba(117,182,209,0.7), rgba(117,182,209,0))",
          left: -100,
          top: -120,
          transform: `translateY(${y}px)`,
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 440,
          height: 440,
          borderRadius: 9999,
          background:
            "radial-gradient(circle at center, rgba(79,134,181,0.55), rgba(79,134,181,0))",
          right: -160,
          top: "26%",
          transform: `translateY(${-y * 0.7}px)`,
          filter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 560,
          height: 560,
          borderRadius: 9999,
          background:
            "radial-gradient(circle at center, rgba(166,184,207,0.5), rgba(166,184,207,0))",
          left: "38%",
          bottom: -180,
          transform: `translateY(${y * 0.5}px)`,
          filter: "blur(2px)",
        }}
      />
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Cursor                                                             */
/* ------------------------------------------------------------------ */

const Cursor: React.FC<{ x: number; y: number; opacity?: number }> = ({
  x,
  y,
  opacity = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 24,
      height: 24,
      opacity,
      zIndex: 100,
      filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
      pointerEvents: "none",
    }}
  >
    <svg viewBox="0 0 24 24" width={24} height={24}>
      <path
        d="M5 3l14 8-6.5 1.5L11 19z"
        fill="#fff"
        stroke="#1d3048"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Scene helper for fade transitions                                  */
/* ------------------------------------------------------------------ */

const SceneFade: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
}> = ({ children, durationInFrames }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  return (
    <AbsoluteFill style={{ opacity, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {children}
    </AbsoluteFill>
  );
};

/* ================================================================== */
/*  SCENE 1 — Dashboard Queue (frames 0-55)                           */
/* ================================================================== */

const SceneDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const jobs = [
    { med: "Vancomycin 15 mg/mL Oral Soln", patient: "Sarah Chen", status: "verified" as const, priority: 5, route: "Oral", due: "Feb 22, 10:30 AM" },
    { med: "Morphine Sulfate 2 mg/mL Syrup", patient: "James Wilson", status: "in_progress" as const, priority: 4, route: "Oral", due: "Feb 22, 11:00 AM" },
    { med: "Gabapentin 50 mg/mL Suspension", patient: "Maria Lopez", status: "queued" as const, priority: 3, route: "Oral", due: "Feb 22, 1:00 PM" },
    { med: "Omeprazole 2 mg/mL Oral Susp", patient: "Robert Kim", status: "needs_review" as const, priority: 4, route: "Oral", due: "Feb 22, 2:00 PM" },
  ];

  const statusStyles = {
    verified: { bg: "rgba(207,250,230,0.85)", text: "#065f46", border: "rgba(110,231,183,0.8)" },
    in_progress: { bg: "rgba(224,242,254,0.8)", text: "#075985", border: "rgba(125,211,252,0.8)" },
    queued: { bg: "rgba(255,255,255,0.4)", text: "#475569", border: "rgba(203,213,225,0.8)" },
    needs_review: { bg: "rgba(254,243,199,0.9)", text: "#92400e", border: "rgba(252,211,77,0.9)" },
  };

  const statusLabels = {
    verified: "Verified",
    in_progress: "In Progress",
    queued: "Queued",
    needs_review: "Needs Review",
  };

  // Cursor moves toward first row
  const cursorX = interpolate(frame, [30, 50], [900, 580], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const cursorY = interpolate(frame, [30, 50], [300, 330], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const cursorOpacity = interpolate(frame, [25, 30, 50, 55], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Highlight first row
  const rowHighlight = interpolate(frame, [42, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <SceneFade durationInFrames={55}>
      <AbsoluteFill style={{ background: S.background }}>
        <OrbBg />
        <Header />

        <div style={{ position: "absolute", top: 100, left: 48, right: 48 }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            {[
              { label: "Queue Today", value: "4" },
              { label: "High Priority", value: "2" },
              { label: "Ready For Signoff", value: "1" },
              { label: "Escalated", value: "1" },
            ].map((stat, i) => {
              const s = spring({ frame: frame - i * 3, fps, config: { damping: 18, stiffness: 120 } });
              return (
                <GlassCard
                  key={stat.label}
                  style={{
                    transform: `translateY(${(1 - s) * 20}px)`,
                    opacity: s,
                  }}
                >
                  <p style={S.statLabel}>{stat.label}</p>
                  <p style={S.statValue}>{stat.value}</p>
                </GlassCard>
              );
            })}
          </div>

          {/* Queue card */}
          <GlassCard style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#475569", textTransform: "uppercase" }}>
                  Compounding Queue
                </p>
                <p style={{ fontSize: 24, fontWeight: 600, color: "#0f172a" }}>
                  Today&apos;s Jobs
                </p>
              </div>
              <span style={{ borderRadius: 9999, border: `1px solid ${S.colors.white60}`, background: S.colors.white30, padding: "6px 14px", fontSize: 12, color: "#475569" }}>
                Patient-specific → Company → Generated Formula Cascade
              </span>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {jobs.map((job, i) => {
                const delay = 6 + i * 4;
                const rowSpring = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 110 } });
                const isFirst = i === 0;
                return (
                  <div
                    key={job.patient}
                    style={{
                      ...S.queueRow,
                      opacity: rowSpring,
                      transform: `translateY(${(1 - rowSpring) * 16}px)`,
                      background: isFirst
                        ? `rgba(255,255,255,${0.28 + rowHighlight * 0.15})`
                        : S.colors.white28,
                      boxShadow: isFirst && rowHighlight > 0.5
                        ? "0 20px 40px -30px rgba(15,56,102,0.6)"
                        : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <StatusPill
                        label={statusLabels[job.status]}
                        bg={statusStyles[job.status].bg}
                        text={statusStyles[job.status].text}
                        border={statusStyles[job.status].border}
                      />
                      <span style={{ fontSize: 13, color: "#475569" }}>
                        P{job.priority} • Iterations 1
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: 17, fontWeight: 600, color: "#0f172a" }}>{job.med}</p>
                      <p style={{ fontSize: 13, color: "#475569" }}>
                        {job.patient} • {job.route}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 13, color: "#475569" }}>Due</p>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{job.due}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        <Cursor x={cursorX} y={cursorY} opacity={cursorOpacity} />
      </AbsoluteFill>
    </SceneFade>
  );
};

/* ================================================================== */
/*  SCENE 2 — Job Detail: Patient & Prescription (frames 55-105)      */
/* ================================================================== */

const SceneJobDetail: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 100 } });

  return (
    <SceneFade durationInFrames={50}>
      <AbsoluteFill style={{ background: S.background }}>
        <OrbBg />
        <Header />

        <div style={{ position: "absolute", top: 100, left: 48, right: 48 }}>
          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, opacity: appear(0) }}>
            <div style={{ ...S.pillBtn, background: "linear-gradient(170deg, rgba(255,255,255,0.62), rgba(225,234,242,0.32))", color: S.colors.inkStrong, borderColor: "rgba(255,255,255,0.78)", fontSize: 13 }}>
              ← Back to Queue
            </div>
            <StatusPill label="Verified" bg="rgba(207,250,230,0.85)" text="#065f46" border="rgba(110,231,183,0.8)" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
            {/* Left – Job Summary */}
            <GlassCard style={{ transform: `translateY(${(1 - appear(2)) * 20}px)`, opacity: appear(2) }}>
              <p style={{ ...S.summaryLabel, marginBottom: 4 }}>Job Summary</p>
              <p style={{ fontSize: 26, fontWeight: 600, color: "#0f172a", marginBottom: 14 }}>
                Vancomycin 15 mg/mL Oral Soln
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                <div style={{ borderRadius: 18, border: `1px solid ${S.colors.white60}`, background: S.colors.white25, padding: 14 }}>
                  <p style={S.summaryLabel}>Patient</p>
                  <p style={S.summaryValue}>Sarah Chen</p>
                  <p style={S.summarySub}>Weight 68 kg • Allergies: Penicillin</p>
                </div>
                <div style={{ borderRadius: 18, border: `1px solid ${S.colors.white60}`, background: S.colors.white25, padding: 14 }}>
                  <p style={S.summaryLabel}>Prescription</p>
                  <p style={S.summaryValue}>15 mg/kg • 4x/day</p>
                  <p style={S.summarySub}>15 mg/mL • 200 mL</p>
                </div>
              </div>

              <div style={{ borderRadius: 18, border: `1px solid ${S.colors.white60}`, background: S.colors.white25, padding: 14 }}>
                <p style={S.summaryLabel}>Resolved Formula</p>
                <p style={S.summaryValue}>Vancomycin Oral Solution (Company Library)</p>
                <p style={S.summarySub}>Dissolve vancomycin powder in cherry-flavored vehicle. Mix until uniform. QS to final volume.</p>
              </div>

              <p style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>
                Due Feb 22, 10:30 AM
              </p>
            </GlassCard>

            {/* Right – Action Panel Preview */}
            <GlassCard style={{ transform: `translateY(${(1 - appear(6)) * 20}px)`, opacity: appear(6) }}>
              <p style={{ ...S.summaryLabel, marginBottom: 8 }}>Workflow Actions</p>

              <div style={{ background: "rgba(255,255,255,0.35)", borderRadius: 16, border: `1px solid ${S.colors.white60}`, padding: 12, marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Pharmacist Context</p>
                <div style={{ borderRadius: 12, border: `1px solid rgba(255,255,255,0.66)`, background: S.colors.white42, padding: "8px 12px", fontSize: 13, color: "#6f8096" }}>
                  Patient has hx of renal impairment — verify dose ceiling...
                </div>
              </div>

              <div
                style={{
                  ...S.pillBtn,
                  width: "100%",
                  textAlign: "center",
                  fontSize: 14,
                  marginBottom: 10,
                }}
              >
                Run Deterministic Pipeline
              </div>

              <div style={{ background: "rgba(255,255,255,0.35)", borderRadius: 16, border: `1px solid ${S.colors.white60}`, padding: 12 }}>
                <p style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>Signature Setup</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ borderRadius: 12, border: `1px solid rgba(255,255,255,0.66)`, background: S.colors.white42, padding: "8px 12px", fontSize: 12, color: "#6f8096" }}>
                    ●●●●●●
                  </div>
                  <div style={{ borderRadius: 12, border: `1px solid rgba(255,255,255,0.66)`, background: S.colors.white42, padding: "8px 12px", fontSize: 12, color: "#6f8096" }}>
                    ●●●●●●
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};

/* ================================================================== */
/*  SCENE 3 — Deterministic Calculations (frames 105-155)             */
/* ================================================================== */

const SceneCalculations: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 100 } });

  // Counting animation for values
  const singleDose = Math.round(interpolate(frame, [8, 22], [0, 1020], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const dailyDose = Math.round(interpolate(frame, [12, 26], [0, 4080], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <SceneFade durationInFrames={50}>
      <AbsoluteFill style={{ background: S.background }}>
        <OrbBg />
        <Header />

        <div style={{ position: "absolute", top: 100, left: 48, right: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, opacity: appear(0) }}>
            <div style={{ ...S.pillBtn, background: "linear-gradient(170deg, rgba(255,255,255,0.62), rgba(225,234,242,0.32))", color: S.colors.inkStrong, borderColor: "rgba(255,255,255,0.78)", fontSize: 13 }}>
              ← Back to Queue
            </div>
            <StatusPill label="Verified" bg="rgba(207,250,230,0.85)" text="#065f46" border="rgba(110,231,183,0.8)" />
          </div>

          {/* Title area */}
          <div style={{ marginBottom: 16, opacity: appear(2) }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: "#475569", textTransform: "uppercase" }}>
              Deterministic Engine
            </p>
            <p style={{ fontSize: 28, fontWeight: 600, color: "#0f172a" }}>
              Calculation Results — Vancomycin 15 mg/mL
            </p>
          </div>

          {/* Calculation cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
            <GlassCard style={{ transform: `translateY(${(1 - appear(4)) * 20}px)`, opacity: appear(4) }}>
              <p style={S.summaryLabel}>Single Dose</p>
              <p style={{ ...S.statValue, fontSize: 36, color: S.colors.ocean }}>
                {singleDose} <span style={{ fontSize: 18 }}>mg</span>
              </p>
              <p style={S.summarySub}>15 mg/kg × 68 kg</p>
            </GlassCard>
            <GlassCard style={{ transform: `translateY(${(1 - appear(7)) * 20}px)`, opacity: appear(7) }}>
              <p style={S.summaryLabel}>Daily Dose</p>
              <p style={{ ...S.statValue, fontSize: 36, color: S.colors.ocean }}>
                {dailyDose} <span style={{ fontSize: 18 }}>mg</span>
              </p>
              <p style={S.summarySub}>1020 mg × 4 doses/day</p>
            </GlassCard>
            <GlassCard style={{ transform: `translateY(${(1 - appear(10)) * 20}px)`, opacity: appear(10) }}>
              <p style={S.summaryLabel}>Beyond Use Date</p>
              <p style={{ ...S.statValue, fontSize: 28, color: S.colors.ocean }}>
                2026-03-08
              </p>
              <p style={S.summarySub}>14-day BUD per USP &lt;795&gt;</p>
            </GlassCard>
          </div>

          {/* Preparation steps */}
          <GlassCard style={{ opacity: appear(13), transform: `translateY(${(1 - appear(13)) * 16}px)` }}>
            <p style={{ ...S.summaryLabel, marginBottom: 10 }}>Preparation Steps</p>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                "1. Weigh 3,000 mg vancomycin HCl powder (lot VNC-2026-1142, exp 2027-08)",
                "2. Dissolve in 50 mL purified water with gentle agitation",
                "3. Add cherry-flavored OraSweet vehicle QS to 200 mL",
                "4. Mix until uniform, verify no undissolved particles",
                "5. Transfer to amber prescription bottle, affix label",
              ].map((step, i) => {
                const stepAppear = appear(15 + i * 3);
                return (
                  <div
                    key={i}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${S.colors.white60}`,
                      background: S.colors.white25,
                      padding: "8px 14px",
                      fontSize: 14,
                      color: S.colors.inkStrong,
                      fontWeight: 500,
                      opacity: stepAppear,
                      transform: `translateX(${(1 - stepAppear) * 12}px)`,
                    }}
                  >
                    {step}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};

/* ================================================================== */
/*  SCENE 4 — Safety Checks (frames 155-205)                          */
/* ================================================================== */

const SceneSafetyChecks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 100 } });

  const hardChecks = [
    { key: "Dose Range Check", detail: "1020 mg single dose within 10–20 mg/kg range for adult oral route", status: "PASS" as const },
    { key: "Unit Verification", detail: "All units consistent: mg/kg → mg → mg/mL → mL", status: "PASS" as const },
    { key: "Incompatibility Screen", detail: "No known incompatibilities between vancomycin HCl and OraSweet vehicle", status: "PASS" as const },
    { key: "Allergy Cross-Check", detail: "Penicillin allergy noted — vancomycin is glycopeptide class, no cross-reactivity", status: "PASS" as const },
    { key: "BUD Compliance", detail: "14-day BUD compliant with USP <795> for aqueous oral preparation at CRT", status: "PASS" as const },
    { key: "Lot & Expiry Validation", detail: "Lot VNC-2026-1142 exp 2027-08 — within acceptable range", status: "PASS" as const },
  ];

  const aiChecks = [
    { key: "Clinical Reasonableness", detail: "Dose appropriate for C. difficile treatment in 68 kg adult", status: "PASS" as const },
    { key: "Preparation Completeness", detail: "All excipients, equipment, and steps accounted for", status: "PASS" as const },
    { key: "Citation Quality", detail: "3 external references verified against PubMed and FDA sources", status: "PASS" as const },
  ];

  return (
    <SceneFade durationInFrames={50}>
      <AbsoluteFill style={{ background: S.background }}>
        <OrbBg />
        <Header />

        <div style={{ position: "absolute", top: 100, left: 48, right: 48 }}>
          <div style={{ marginBottom: 14, opacity: appear(0) }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: "#475569", textTransform: "uppercase" }}>
              Safety Verification
            </p>
            <p style={{ fontSize: 28, fontWeight: 600, color: "#0f172a" }}>
              Hard Checks & AI Review
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Hard checks */}
            <GlassCard>
              <p style={{ ...S.summaryLabel, marginBottom: 10 }}>Deterministic Hard Checks</p>
              <div style={{ display: "grid", gap: 8 }}>
                {hardChecks.map((check, i) => {
                  const a = appear(3 + i * 3);
                  return (
                    <div
                      key={check.key}
                      style={{
                        ...S.checkRow,
                        opacity: a,
                        transform: `translateX(${(1 - a) * 12}px)`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{check.key}</p>
                        <CheckBadge status={check.status} />
                      </div>
                      <p style={{ fontSize: 11, color: "#475569" }}>{check.detail}</p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* AI checks + citations */}
            <GlassCard>
              <p style={{ ...S.summaryLabel, marginBottom: 10 }}>AI + External Review</p>
              <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                {aiChecks.map((check, i) => {
                  const a = appear(8 + i * 3);
                  return (
                    <div
                      key={check.key}
                      style={{
                        ...S.checkRow,
                        opacity: a,
                        transform: `translateX(${(1 - a) * 12}px)`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{check.key}</p>
                        <CheckBadge status={check.status} />
                      </div>
                      <p style={{ fontSize: 11, color: "#475569" }}>{check.detail}</p>
                    </div>
                  );
                })}
              </div>

              <p style={{ ...S.summaryLabel, marginBottom: 8 }}>External References</p>
              <div style={{ display: "grid", gap: 6 }}>
                {[
                  { title: "Vancomycin Oral — Lexi-Comp Monograph", source: "LexiComp" },
                  { title: "C. difficile Treatment Guidelines — IDSA 2021", source: "PubMed" },
                  { title: "USP <795> Nonsterile Compounding Standards", source: "FDA/USP" },
                ].map((ref, i) => {
                  const a = appear(18 + i * 3);
                  return (
                    <div
                      key={ref.title}
                      style={{
                        borderRadius: 14,
                        border: `1px solid rgba(255,255,255,0.56)`,
                        background: "rgba(255,255,255,0.24)",
                        padding: "8px 12px",
                        opacity: a,
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{ref.title}</p>
                      <p style={{ fontSize: 11, color: "#475569" }}>{ref.source}</p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};

/* ================================================================== */
/*  SCENE 5 — Pharmacist Approval (frames 205-250)                    */
/* ================================================================== */

const SceneApproval: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 100 } });

  // Cursor clicks approve button
  const cursorX = interpolate(frame, [22, 38], [700, 540], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const cursorY = interpolate(frame, [22, 38], [400, 575], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const cursorOpacity = interpolate(frame, [18, 22, 38, 42], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const approveGlow = interpolate(frame, [36, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <SceneFade durationInFrames={45}>
      <AbsoluteFill style={{ background: S.background }}>
        <OrbBg />
        <Header />

        <div style={{ position: "absolute", top: 100, left: 48, right: 48, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Left - Structured Summary */}
          <GlassCard style={{ opacity: appear(0), transform: `translateY(${(1 - appear(0)) * 16}px)` }}>
            <p style={{ ...S.summaryLabel, marginBottom: 6 }}>Structured Summary for Review</p>
            <p style={{ fontSize: 22, fontWeight: 600, color: "#0f172a", marginBottom: 12 }}>
              Vancomycin 15 mg/mL Oral Soln
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ borderRadius: 16, border: `1px solid ${S.colors.white60}`, background: S.colors.white25, padding: 10 }}>
                <p style={S.summaryLabel}>Single Dose</p>
                <p style={{ ...S.summaryValue, color: S.colors.ocean }}>1,020 mg</p>
              </div>
              <div style={{ borderRadius: 16, border: `1px solid ${S.colors.white60}`, background: S.colors.white25, padding: 10 }}>
                <p style={S.summaryLabel}>Daily Dose</p>
                <p style={{ ...S.summaryValue, color: S.colors.ocean }}>4,080 mg</p>
              </div>
              <div style={{ borderRadius: 16, border: `1px solid ${S.colors.white60}`, background: S.colors.white25, padding: 10 }}>
                <p style={S.summaryLabel}>BUD</p>
                <p style={{ ...S.summaryValue, color: S.colors.ocean }}>2026-03-08</p>
              </div>
            </div>

            <p style={{ ...S.summaryLabel, marginBottom: 6 }}>All 6 Hard Checks</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {["Dose Range", "Units", "Incompatibilities", "Allergies", "BUD Rules", "Lot/Expiry"].map((c) => (
                <span key={c} style={{ borderRadius: 9999, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", background: S.colors.checkPass, color: S.colors.checkPassText }}>
                  {c} ✓
                </span>
              ))}
            </div>

            <p style={{ ...S.summaryLabel, marginBottom: 6 }}>3 External Citations Verified</p>
            <p style={{ fontSize: 12, color: "#475569" }}>
              Lexi-Comp • IDSA Guidelines • USP &lt;795&gt;
            </p>
          </GlassCard>

          {/* Right - Signing Panel */}
          <GlassCard style={{ opacity: appear(4), transform: `translateY(${(1 - appear(4)) * 16}px)` }}>
            <p style={{ ...S.summaryLabel, marginBottom: 10 }}>Pharmacist Sign-Off</p>

            <div style={{ background: "rgba(255,255,255,0.35)", borderRadius: 16, border: `1px solid ${S.colors.white60}`, padding: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Signature Meaning</p>
              <div style={{ borderRadius: 12, border: `1px solid rgba(255,255,255,0.66)`, background: S.colors.white42, padding: "8px 12px", fontSize: 13, color: S.colors.inkStrong, fontWeight: 500 }}>
                Reviewed and Approved
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.35)", borderRadius: 16, border: `1px solid ${S.colors.white60}`, padding: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Challenge Code</p>
              <div style={{ borderRadius: 12, border: `1px solid rgba(79,134,181,0.55)`, background: "rgba(255,255,255,0.56)", padding: "8px 12px", fontSize: 15, fontFamily: "'IBM Plex Mono', monospace", color: S.colors.inkStrong, fontWeight: 600, boxShadow: "0 0 0 3px rgba(79,134,181,0.2)" }}>
                A7-K3-M9
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.35)", borderRadius: 16, border: `1px solid ${S.colors.white60}`, padding: 12, marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Approval Rationale</p>
              <div style={{ borderRadius: 12, border: `1px solid rgba(255,255,255,0.66)`, background: S.colors.white42, padding: "8px 12px", fontSize: 13, color: S.colors.inkStrong }}>
                All deterministic checks pass. Dose appropriate for indication. Verified against external references.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, color: S.colors.inkStrong }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: S.colors.ocean, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>
              </div>
              I attest this record is accurate under 21 CFR Part 11
            </div>

            <div
              style={{
                ...S.pillBtn,
                width: "100%",
                textAlign: "center",
                fontSize: 15,
                boxShadow: approveGlow > 0
                  ? `0 0 ${30 * approveGlow}px ${10 * approveGlow}px rgba(79,134,181,0.4), 0 16px 32px -22px rgba(16,54,97,0.95)`
                  : S.pillBtn.boxShadow,
                transform: approveGlow > 0.5 ? "scale(0.98)" : "none",
              }}
            >
              Approve + Generate Final Label
            </div>
          </GlassCard>
        </div>

        <Cursor x={cursorX} y={cursorY} opacity={cursorOpacity} />
      </AbsoluteFill>
    </SceneFade>
  );
};

/* ================================================================== */
/*  SCENE 6 — Label + Audit Trail (frames 250-300)                    */
/* ================================================================== */

const SceneFinalOutput: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 100 } });

  const labelJson = `{
  "medication": "Vancomycin 15 mg/mL Oral Solution",
  "patient": "Sarah Chen",
  "dose": "1020 mg (68 mL) four times daily",
  "bud": "2026-03-08",
  "storage": "Refrigerate 2–8 °C",
  "lot": "VNC-2026-1142",
  "pharmacist": "Chris Martinez, PharmD",
  "compoundedDate": "2026-02-22"
}`;

  return (
    <SceneFade durationInFrames={50}>
      <AbsoluteFill style={{ background: S.background }}>
        <OrbBg />
        <Header />

        <div style={{ position: "absolute", top: 100, left: 48, right: 48 }}>
          {/* Success banner */}
          <div
            style={{
              borderRadius: 20,
              border: "1px solid rgba(110,231,183,0.6)",
              background: "rgba(207,250,230,0.6)",
              padding: "12px 20px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: appear(0),
              transform: `translateY(${(1 - appear(0)) * 12}px)`,
            }}
          >
            <span style={{ fontSize: 20 }}>✓</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#065f46" }}>
              Job approved successfully — compounding record, label data, and audit trail generated
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Left – Final output */}
            <GlassCard style={{ opacity: appear(4), transform: `translateY(${(1 - appear(4)) * 16}px)` }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: "#1e293b", marginBottom: 12 }}>Final Output</p>

              <div style={{ borderRadius: 18, border: `1px solid ${S.colors.white60}`, background: S.colors.white30, padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>Approved Feb 22, 2026, 10:14 AM</p>
                <p style={{ fontSize: 12, color: "#475569" }}>
                  Signed by Chris Martinez (chris@medivance.io) • Reviewed And Approved
                </p>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  Signature hash: <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>a7f3e2c901b4d8...</span>
                </p>
              </div>

              <p style={{ ...S.summaryLabel, marginBottom: 8 }}>Label Preview</p>
              <div
                style={{
                  borderRadius: 15,
                  border: `1px solid rgba(255,255,255,0.52)`,
                  background: "rgba(255,255,255,0.36)",
                  padding: 14,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  color: "#2c4565",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {labelJson}
              </div>
            </GlassCard>

            {/* Right – Audit trail */}
            <div style={{ display: "grid", gap: 16 }}>
              <GlassCard style={{ opacity: appear(8), transform: `translateY(${(1 - appear(8)) * 16}px)` }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", marginBottom: 10 }}>Audit Trail</p>
                <div style={{ display: "grid", gap: 6 }}>
                  {[
                    { event: "job.created", time: "9:42 AM" },
                    { event: "pipeline.started", time: "9:42 AM" },
                    { event: "formula.resolved", time: "9:42 AM" },
                    { event: "calculations.complete", time: "9:43 AM" },
                    { event: "hard_checks.passed", time: "9:43 AM" },
                    { event: "ai_review.passed", time: "9:44 AM" },
                    { event: "status → verified", time: "9:44 AM" },
                    { event: "pharmacist.approved", time: "10:14 AM" },
                    { event: "label.generated", time: "10:14 AM" },
                    { event: "status → approved", time: "10:14 AM" },
                  ].map((e, i) => {
                    const a = appear(10 + i * 2);
                    return (
                      <div
                        key={e.event}
                        style={{
                          borderRadius: 14,
                          border: `1px solid rgba(255,255,255,0.56)`,
                          background: "rgba(255,255,255,0.24)",
                          padding: "6px 12px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          opacity: a,
                          transform: `translateX(${(1 - a) * 10}px)`,
                        }}
                      >
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{e.event}</p>
                        <p style={{ fontSize: 11, color: "#64748b" }}>Feb 22, {e.time}</p>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};

/* ================================================================== */
/*  MAIN COMPOSITION                                                   */
/* ================================================================== */

export const DemoVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: S.background, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <Sequence from={0} durationInFrames={55} name="Dashboard Queue">
        <SceneDashboard />
      </Sequence>
      <Sequence from={53} durationInFrames={50} name="Job Detail">
        <SceneJobDetail />
      </Sequence>
      <Sequence from={101} durationInFrames={50} name="Calculations">
        <SceneCalculations />
      </Sequence>
      <Sequence from={149} durationInFrames={50} name="Safety Checks">
        <SceneSafetyChecks />
      </Sequence>
      <Sequence from={197} durationInFrames={50} name="Approval">
        <SceneApproval />
      </Sequence>
      <Sequence from={248} durationInFrames={52} name="Final Output">
        <SceneFinalOutput />
      </Sequence>
    </AbsoluteFill>
  );
};
