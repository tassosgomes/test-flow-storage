import { resultLabel } from "@tfs/schema";

export type Tone = "pass" | "fail" | "blocked" | "ne";

const DOT: Record<Tone, string> = {
  pass: "/brand/dot-pass.svg",
  fail: "/brand/dot-fail.svg",
  blocked: "/brand/dot-blocked.svg",
  ne: "/brand/dot-ne.svg",
};

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      <img src={DOT[tone]} alt="" width={6} height={6} />
      {children}
    </span>
  );
}

export function verdictTone(label: string): Tone {
  if (label === "APROVADO") return "pass";
  if (label === "REPROVADO") return "fail";
  return "ne";
}

export function VerdictBadge({ overall }: { overall: string | null | undefined }) {
  const label = resultLabel(overall);
  return <Badge tone={verdictTone(label)}>{label}</Badge>;
}
