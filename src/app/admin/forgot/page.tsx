import type { Metadata } from "next";
import { AdminForgotForm } from "@/components/admin/ResetForms";

export const metadata: Metadata = { title: "Forgot password" };

export default function AdminForgotPage() {
  return <AdminForgotForm />;
}
