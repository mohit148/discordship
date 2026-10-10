import { redirect } from "next/navigation";
import { getVisibleNavItems } from "@/lib/data/nav";

export const dynamic = "force-dynamic";

// Lands on the first page that's currently shown in the navigation (Ships by
// default), so hiding Ships doesn't leave the front door pointing at a 404.
export default async function RootPage() {
  const items = await getVisibleNavItems();
  redirect(items[0]?.href ?? "/about");
}
