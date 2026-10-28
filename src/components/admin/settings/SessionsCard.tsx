import { LogOut, MonitorSmartphone } from "lucide-react";
import { signOutOtherSessions } from "@/actions/admin/account";
import { ConfirmButton } from "@/components/admin/forms";
import { Badge, Card } from "@/components/admin/ui";
import { shortDate } from "@/lib/admin/format";

type Session = { ip: string | null; userAgent: string | null; createdAt: Date; current: boolean };

const SHOWN = 8;

/** "Chrome on macOS" from a user-agent string. Order matters: Edge/Opera contain "Chrome", Chrome contains "Safari", iOS contains "Mac OS X". */
function describeDevice(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  return os ? `${browser} on ${os}` : browser;
}

export function SessionsCard({ sessions }: { sessions: Session[] }) {
  const others = sessions.filter((s) => !s.current).length;
  // This browser first, then newest.
  const shown = [...sessions].sort((a, b) => Number(b.current) - Number(a.current)).slice(0, SHOWN);
  return (
    <Card title="Sessions" description="Browsers signed in to the console with your account." className="h-fit">
      <div className="flex items-end gap-3">
        <span className="font-display text-5xl leading-none tabular-nums">{sessions.length}</span>
        <span className="pb-1 text-sm text-muted">active session{sessions.length === 1 ? "" : "s"}</span>
      </div>
      <ul className="mt-4 divide-y divide-line/70 border-y border-line/70 text-sm">
        {shown.map((s, i) => (
          <li key={i} className="flex items-start gap-3 py-2.5">
            <MonitorSmartphone className="mt-0.5 size-4 shrink-0 text-dim" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-fg/90">{describeDevice(s.userAgent)}</div>
              <div className="truncate text-xs text-dim">
                {s.ip ?? "Unknown IP"} · signed in {shortDate(s.createdAt)}
              </div>
            </div>
            {s.current && (
              <Badge tone="ok" className="shrink-0 normal-case">
                This browser
              </Badge>
            )}
          </li>
        ))}
      </ul>
      {sessions.length > SHOWN && <p className="mt-2 text-xs text-dim">+ {sessions.length - SHOWN} more</p>}
      {others > 0 ? (
        <ConfirmButton
          action={signOutOtherSessions}
          confirm={`Sign out ${others} other session${others === 1 ? "" : "s"}? You'll stay signed in here.`}
          size="md"
          className="mt-4 w-full"
        >
          <LogOut className="size-4" /> Sign out other devices
        </ConfirmButton>
      ) : (
        <p className="mt-4 text-xs text-dim">You&apos;re only signed in on this browser.</p>
      )}
    </Card>
  );
}
