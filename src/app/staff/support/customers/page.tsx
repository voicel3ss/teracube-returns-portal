import { redirect } from "next/navigation";

export default function LegacyCustomersPage() {
  redirect("/staff/customers");
}
