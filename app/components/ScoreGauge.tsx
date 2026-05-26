interface ScoreGaugeProps {
  score: number;
  size?: "small" | "large";
}

function getColor(score: number): string {
  if (score >= 80) return "#008060";
  if (score >= 50) return "#b98900";
  return "#d72c0d";
}

function getLabel(score: number): string {
  if (score === 100) return "Perfect score";
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Needs work";
  return "At risk";
}

function getCongratsLine(score: number): string | null {
  if (score === 100) return "Congratulations — you're launch-ready.";
  return null;
}

export function ScoreGauge({ score, size = "large" }: ScoreGaugeProps) {
  const color = getColor(score);
  const dimension = size === "large" ? 148 : 88;
  const strokeWidth = size === "large" ? 10 : 7;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(score, 2) / 100;
  const offset = circumference - progress * circumference;
  const fontSize = size === "large" ? 40 : 24;
  const labelSize = size === "large" ? 13 : 11;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: size === "large" ? 8 : 4,
      }}
    >
      <div style={{ position: "relative", width: dimension, height: dimension }}>
        <svg
          width={dimension}
          height={dimension}
          style={{ transform: "rotate(-90deg)", display: "block" }}
          aria-hidden
        >
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke="#e8eaed"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize,
              fontWeight: 700,
              color,
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            {score}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: labelSize,
            fontWeight: 650,
            color: "#1a1f2e",
            letterSpacing: "-0.01em",
          }}
        >
          Launch Score
        </div>
        {size === "large" && (
          <>
            <div
              style={{
                fontSize: 12,
                color: score === 100 ? "#008060" : "#637381",
                marginTop: 2,
                fontWeight: score === 100 ? 600 : 400,
              }}
            >
              {getLabel(score)}
            </div>
            {getCongratsLine(score) && (
              <div style={{ fontSize: 11, color: "#008060", marginTop: 4, maxWidth: 160 }}>
                {getCongratsLine(score)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
