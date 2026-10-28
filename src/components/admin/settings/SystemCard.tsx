import { Badge, Card, DescriptionList } from "@/components/admin/ui";
import type { SystemInfo } from "@/lib/admin/settings";

/** Read-only server configuration. Shows whether things are set up — never secret values. */
export function SystemCard({ info }: { info: SystemInfo }) {
  return (
    <Card title="System" description="Read-only — configured with environment variables on the server.">
      <DescriptionList
        items={[
          { label: "Database", value: <Badge tone="ok">Connected</Badge> },
          {
            label: "Uploads",
            value: (
              <>
                <span className="font-mono text-xs">{info.storageDriver}</span>
                <span className="block text-xs text-dim">{info.storageDriver === "s3" ? "S3-compatible bucket" : "This server's disk"}</span>
              </>
            ),
          },
          {
            label: "Email notifications",
            value: info.emailEnabled ? <Badge tone="ok">On</Badge> : <span className="text-muted">Off — add RESEND_API_KEY and EMAIL_FROM</span>,
          },
          {
            label: "Order alerts",
            value: info.orderAlertEmail ? (
              <>
                {info.orderAlertEmail}
                {!info.emailEnabled && <span className="block text-xs text-dim">Sent once email is on</span>}
              </>
            ) : (
              <span className="text-dim">Not set</span>
            ),
          },
        ]}
      />
    </Card>
  );
}
