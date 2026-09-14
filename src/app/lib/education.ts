import { platform } from "./platform";

export interface Programme {
  id: string;
  title: string;
  community_id: string | null;
  modules: { id: string; position: number; title: string }[];
}

/** Completed module ids, per entrepreneur. */
export type CompletedByEntrepreneur = Map<string, Set<string>>;

/**
 * The programmes open to a community (EmpowerFI's, plus its own) and how far
 * each of the given members has got. RLS limits progress to members the
 * viewer may see.
 */
export async function loadEducation(communityId: string, entrepreneurIds: string[]) {
  const [programmes, progress] = await Promise.all([
    platform
      .from("education_programs")
      .select("id, title, community_id, education_modules(id, position, title)")
      .or(`community_id.is.null,community_id.eq.${communityId}`)
      .order("community_id", { nullsFirst: true }),
    entrepreneurIds.length
      ? platform
          .from("education_progress")
          .select("entrepreneur_id, module_id")
          .eq("status", "completed")
          .in("entrepreneur_id", entrepreneurIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (programmes.error) throw programmes.error;
  if (progress.error) throw progress.error;

  const completed: CompletedByEntrepreneur = new Map();
  for (const row of progress.data ?? []) {
    if (!completed.has(row.entrepreneur_id)) completed.set(row.entrepreneur_id, new Set());
    completed.get(row.entrepreneur_id)!.add(row.module_id);
  }

  const list: Programme[] = (programmes.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    community_id: p.community_id,
    modules: [...(p.education_modules ?? [])].sort((a, b) => a.position - b.position),
  }));
  return { programmes: list, completed };
}
