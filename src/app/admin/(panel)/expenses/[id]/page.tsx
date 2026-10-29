import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteExpense, saveExpense } from "@/actions/admin/expenses";
import { ExpenseForm } from "@/components/admin/ExpenseForm";
import { ConfirmButton } from "@/components/admin/forms";
import { Card, PageHeader } from "@/components/admin/ui";
import { getExpense, listExpenseCategories } from "@/lib/admin/expenses";
import { dateTime, money, shortDate } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Edit expense" };
// Admin pages read the session and live data on every request.
export const instant = false;

export default async function EditExpensePage({ params }: PageProps<"/admin/expenses/[id]">) {
  await requireAdmin("admin");
  const { id } = await params;
  const expenseId = Number(id);
  if (!Number.isInteger(expenseId) || expenseId < 1) notFound();
  const [expense, categories] = await Promise.all([getExpense(expenseId), listExpenseCategories()]);
  if (!expense) notFound();

  return (
    <>
      <PageHeader
        title={money(expense.amountCents)}
        description={`${expense.category} · ${shortDate(expense.spentOn)}${expense.vendor ? ` · ${expense.vendor}` : ""}`}
        back={{ href: "/admin/expenses", label: "Expenses" }}
        actions={
          <ConfirmButton action={deleteExpense.bind(null, expense.id)} confirm={`Delete this ${money(expense.amountCents)} expense permanently?`} variant="danger">
            <Trash2 className="size-3.5" /> Delete
          </ConfirmButton>
        }
      />
      <Card title="Expense details" description={`Recorded ${dateTime(expense.createdAt)}. Changes update the totals straight away.`}>
        <ExpenseForm action={saveExpense.bind(null, expense.id)} expense={expense} today={expense.spentOn} categories={categories} />
      </Card>
    </>
  );
}
