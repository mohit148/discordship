import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { devStore } from "./dev-store";
import type { BackgroundPreset } from "@/types";

export function backgroundImageUrl(id: string): string {
  return `/api/backgrounds/${id}/image`;
}

function mapRow(row: { id: string; name: string; created_at: string }): BackgroundPreset {
  return { id: row.id, name: row.name, imageUrl: backgroundImageUrl(row.id), createdAt: row.created_at };
}

/**
 * The background catalog, oldest first. This is the only list people can
 * choose from — there's no custom upload for regular users. The image data
 * itself is deliberately not selected here (it's fetched on demand by
 * /api/backgrounds/[id]/image), so listing stays light.
 */
export async function getBackgrounds(): Promise<BackgroundPreset[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("backgrounds").select("id, name, created_at").order("created_at");
      if (error) throw error;
      return (data ?? []).map(mapRow);
    } catch (err) {
      console.error("Failed to load backgrounds from Supabase, falling back to the local dev store", err);
    }
  }
  return devStore.get().backgrounds.map((b) => mapRow({ id: b.id, name: b.name, created_at: b.createdAt }));
}

export async function getBackgroundMap(): Promise<Map<string, BackgroundPreset>> {
  return new Map((await getBackgrounds()).map((b) => [b.id, b]));
}

/** The raw stored image (a data URL) for one background, for the image route. */
export async function getBackgroundImageData(id: string): Promise<string | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase.from("backgrounds").select("image_data").eq("id", id).maybeSingle();
      if (error) throw error;
      return data?.image_data ?? null;
    } catch (err) {
      console.error("Failed to load background image from Supabase, falling back to the local dev store", err);
    }
  }
  return devStore.get().backgrounds.find((b) => b.id === id)?.imageData ?? null;
}

export async function createBackground(name: string, imageData: string): Promise<BackgroundPreset> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("backgrounds")
      .insert({ name, image_data: imageData })
      .select("id, name, created_at")
      .single();
    if (error) throw error;
    return mapRow(data);
  }
  const entry = { id: crypto.randomUUID(), name, imageData, createdAt: new Date().toISOString() };
  devStore.update((s) => {
    s.backgrounds.push(entry);
  });
  return mapRow({ id: entry.id, name, created_at: entry.createdAt });
}

/** Removes a background. Ships using it fall back to the default look. */
export async function deleteBackground(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("backgrounds").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  devStore.update((s) => {
    s.backgrounds = s.backgrounds.filter((b) => b.id !== id);
    for (const ship of s.ships) {
      if (ship.background?.id === id) ship.background = null;
      if (ship.backgroundPending?.id === id) {
        ship.backgroundPending = null;
        ship.backgroundProposedBy = null;
      }
    }
  });
}
