import type { MetadataRoute } from "next";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const BASE_URL = "https://mywaymarks.com";

interface PublicJournalRow {
  share_slug: string;
  updated_at: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  let journalEntries: MetadataRoute.Sitemap = [];
  try {
    const { data, error } = await supabaseAdmin
      .from("journals")
      .select("share_slug, updated_at")
      .eq("is_public", true)
      .not("share_slug", "is", null)
      .returns<PublicJournalRow[]>();
    if (error) throw error;
    journalEntries = (data ?? []).map((j) => ({
      url: `${BASE_URL}/j/${j.share_slug}`,
      lastModified: new Date(j.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));
  } catch (e) {
    console.error("sitemap: failed to load public journals", e);
  }

  return [...staticEntries, ...journalEntries];
}
