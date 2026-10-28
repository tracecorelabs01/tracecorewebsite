import { Badge, type Tone } from "@/components/admin/ui";

const ROLE_TONE: Record<string, Tone> = { owner: "brand", admin: "info", staff: "neutral" };

// Mirrors the `min` roles in AdminShell's navigation.
const ROLE_SUMMARY = [
  { role: "owner", text: "Everything, including staff accounts." },
  { role: "admin", text: "Everything except staff accounts." },
  { role: "staff", text: "Orders, customers, inventory, reviews, messages and subscribers." },
] as const;

export function RoleBadge({ role }: { role: string }) {
  return <Badge tone={ROLE_TONE[role] ?? "neutral"}>{role}</Badge>;
}

export function RoleLegend() {
  return (
    <dl className="space-y-3.5 text-sm">
      {ROLE_SUMMARY.map((r) => (
        <div key={r.role}>
          <dt>
            <RoleBadge role={r.role} />
          </dt>
          <dd className="mt-1 text-muted">{r.text}</dd>
        </div>
      ))}
    </dl>
  );
}
