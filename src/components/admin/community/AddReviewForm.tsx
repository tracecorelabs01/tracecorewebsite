import { ShieldAlert } from "lucide-react";
import { addReview } from "@/actions/admin/reviews";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/admin/forms";

const SOURCES = [
  { value: "trustpilot", label: "Trustpilot" },
  { value: "discord", label: "Discord" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];

/** Admin-only form for importing a genuine review received elsewhere. Saved as approved. */
export function AddReviewForm({ products }: { products: { id: number; name: string; status: string }[] }) {
  return (
    <ActionForm action={addReview} resetOnSuccess className="space-y-4">
      <p className="flex gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-3.5 py-3 text-xs leading-relaxed text-fg/90" role="note">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <span>Only add genuine reviews from real customers — publishing invented reviews is illegal in many countries.</span>
      </p>
      <Field label="Customer name" name="name" hint="As it appears on the original review.">
        <Input name="name" required maxLength={80} autoComplete="off" />
      </Field>
      <Field label="Handle" name="handle" hint="Optional, e.g. a Discord username.">
        <Input name="handle" maxLength={80} autoComplete="off" placeholder="@username" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rating" name="rating">
          <Select name="rating" defaultValue="" required>
            <option value="" disabled>
              Choose…
            </option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {`${n} star${n === 1 ? "" : "s"}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source" name="source">
          <Select name="source" defaultValue="" required>
            <option value="" disabled>
              Choose…
            </option>
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Product" name="productId">
        <Select name="productId" defaultValue="">
          <option value="">General (not about one product)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.status === "active" ? p.name : `${p.name} (${p.status})`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Review" name="body" hint="Paste the customer's words as written.">
        <Textarea name="body" rows={6} maxLength={5000} required />
      </Field>
      <SubmitButton className="w-full" pendingText="Publishing…">
        Publish review
      </SubmitButton>
    </ActionForm>
  );
}
