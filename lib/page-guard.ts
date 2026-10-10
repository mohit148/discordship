import { notFound } from "next/navigation";
import { isPageVisible } from "@/lib/data/nav";
import { getCurrentRole, isAtLeast } from "@/lib/roles";

/**
 * Call at the top of a public page. If an admin has hidden the page, anyone
 * who isn't an admin gets a 404 (admins still get through, so they can
 * preview a page before showing it). Checked live, so no redeploy needed.
 */
export async function guardPage(key: string) {
  if (await isPageVisible(key)) return;
  const role = await getCurrentRole();
  if (!isAtLeast(role, "admin")) notFound();
}
