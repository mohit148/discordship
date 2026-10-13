import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { devStore, DEFAULT_NAV_ITEMS, type NavItemConfig } from "./dev-store";

export type NavItem = NavItemConfig;

/** Public pages that can be hidden/reordered. Admin pages are never in here. */
export const NAV_KEYS = DEFAULT_NAV_ITEMS.map((n) => n.key);

function withDefaults(rows: NavItem[]): NavItem[] {
  const known = new Set(rows.map((r) => r.key));
  const merged = [
    ...rows.filter((r) => NAV_KEYS.includes(r.key)),
    ...DEFAULT_NAV_ITEMS.filter((d) => !known.has(d.key)).map((d) => ({ ...d })),
  ].sort((a, b) => a.position - b.position);
  return merged.map((r, i) => ({ ...r, position: i }));
}

export async function getAllNavItems(): Promise<NavItem[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await createClient().from("nav_items").select("*").order("position");
      if (error) throw error;
      return withDefaults(
        (data ?? []).map((r: any) => ({ key: r.key, label: r.label, href: r.href, visible: r.visible, position: r.position }))
      );
    } catch (err) {
      console.error("Failed to load nav items, using defaults", err);
      return withDefaults([]);
    }
  }
  return withDefaults(devStore.get().navItems);
}

export async function getVisibleNavItems(): Promise<NavItem[]> {
  return (await getAllNavItems()).filter((n) => n.visible);
}

/** Unknown keys count as visible, so a page can never be locked out by a missing row. */
export async function isPageVisible(key: string): Promise<boolean> {
  const item = (await getAllNavItems()).find((n) => n.key === key);
  return item ? item.visible : true;
}

export async function setNavItemVisible(key: string, visible: boolean) {
  const all = await getAllNavItems();
  const item = all.find((n) => n.key === key);
  if (!item) throw new Error("Unknown page");
  if (isSupabaseConfigured()) {
    const { error } = await createServiceRoleClient().from("nav_items").upsert({ ...item, visible });
    if (error) throw error;
    return;
  }
  devStore.update((s) => {
    s.navItems = all.map((n) => (n.key === key ? { ...n, visible } : n));
  });
}

export async function reorderNavItems(order: string[]) {
  const all = await getAllNavItems();
  const byKey = new Map(all.map((n) => [n.key, n]));
  const next = order.map((key, i) => ({ ...byKey.get(key)!, position: i }));
  if (isSupabaseConfigured()) {
    const { error } = await createServiceRoleClient().from("nav_items").upsert(next);
    if (error) throw error;
    return;
  }
  devStore.update((s) => {
    s.navItems = next;
  });
}
