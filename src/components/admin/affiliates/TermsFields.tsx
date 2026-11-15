import { commissionLabel, percentLabel } from "@/lib/affiliate-labels";
import type { Commission, LevelTerms } from "@/lib/affiliate-terms";
import { centsToInput } from "@/lib/admin/format";
import { Field, Input, Select } from "../forms";

/**
 * A group's or partner's own commission and discount limit, for inside its form. Left blank, each one follows the
 * level above (`above`: "the program" or "their group"), whose current value is shown.
 */
export function TermsFields({ own, inherited, above }: { own?: LevelTerms | null; inherited: { commission: Commission; maxDiscount: number }; above: string }) {
  return (
    <>
      <Field label="Commission" name="commissionKind">
        <Select name="commissionKind" defaultValue={own?.commissionKind ?? ""}>
          <option value="">
            Same as {above} ({commissionLabel(inherited.commission)})
          </option>
          <option value="percent">Percent of the price</option>
          <option value="fixed">Fixed $ per unit</option>
        </Select>
      </Field>
      <Field label="Rate (% or $)" name="commissionValue" hint="Only with a commission chosen.">
        <Input name="commissionValue" inputMode="decimal" defaultValue={own?.commissionValue != null ? centsToInput(own.commissionValue) : ""} autoComplete="off" />
      </Field>
      <Field label="Biggest customer discount (%)" name="maxDiscount" hint={`Blank: same as ${above} (${percentLabel(inherited.maxDiscount)}).`}>
        <Input name="maxDiscount" inputMode="decimal" defaultValue={own?.maxDiscount != null ? String(own.maxDiscount / 100) : ""} placeholder={String(inherited.maxDiscount / 100)} autoComplete="off" />
      </Field>
    </>
  );
}
