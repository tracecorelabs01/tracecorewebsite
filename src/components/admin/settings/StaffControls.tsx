import { ChevronRight, KeyRound, Trash2, UserCheck, UserX } from "lucide-react";
import { changeStaffRole, deleteStaff, resetStaffPassword, setStaffActive } from "@/actions/admin/staff";
import { ActionForm, ConfirmButton, FormStatus, Input, Select, SubmitButton } from "@/components/admin/forms";
import { PASSWORD_MIN } from "@/lib/auth/password";

/** Role, access and password controls for another staff member. The actions re-check every rule server-side. */
export function StaffControls({ member }: { member: { id: number; name: string; role: string; isActive: boolean } }) {
  return (
    <div className="space-y-2.5">
      <ActionForm action={changeStaffRole.bind(null, member.id)} showStatus={false} className="flex flex-wrap items-center gap-2">
        <Select name="role" defaultValue={member.role} aria-label={`Role for ${member.name}`} className="h-8 w-28 text-xs">
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </Select>
        <SubmitButton variant="secondary" size="sm">
          Save role
        </SubmitButton>
        <FormStatus className="mt-0 text-xs" />
      </ActionForm>

      <div className="flex flex-wrap items-center gap-2">
        {member.isActive ? (
          <ConfirmButton
            action={setStaffActive.bind(null, member.id, false)}
            confirm={`Disable ${member.name}? They're signed out right away and can't sign in until you enable the account again.`}
          >
            <UserX className="size-3.5" /> Disable
          </ConfirmButton>
        ) : (
          <ConfirmButton action={setStaffActive.bind(null, member.id, true)}>
            <UserCheck className="size-3.5" /> Enable
          </ConfirmButton>
        )}
        <ConfirmButton
          action={deleteStaff.bind(null, member.id)}
          variant="danger"
          confirm={`Delete ${member.name}'s account? This can't be undone, and their past activity will show as “System”. Disable the account instead to keep their name on it.`}
        >
          <Trash2 className="size-3.5" /> Delete
        </ConfirmButton>
      </div>

      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
          <KeyRound className="size-3.5" /> Reset password
        </summary>
        <ActionForm action={resetStaffPassword.bind(null, member.id)} resetOnSuccess showStatus={false} className="mt-2">
          <div className="flex items-center gap-2">
            <Input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN}
              placeholder={`New temporary password (${PASSWORD_MIN}+ characters)`}
              aria-label={`New temporary password for ${member.name}`}
              className="h-8 w-64 text-xs"
            />
            <SubmitButton variant="secondary" size="sm">
              Reset
            </SubmitButton>
          </div>
          <FormStatus className="mt-1.5 text-xs" />
        </ActionForm>
      </details>
    </div>
  );
}
