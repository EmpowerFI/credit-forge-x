import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../../auth/useAuth";
import type { Cohort, CommunityOverview, Journey, OutreachAction, ParticipantRow } from "../../lib/community";
import { ACTION } from "../../lib/community";
import { describeError } from "../../lib/errors";
import { platform } from "../../lib/platform";

// Community Intelligence reads. The database scopes every one to the leaders of
// the community, auditors and admins.

export function useCommunityRow(id: string) {
  return useQuery({
    queryKey: ["platform", "community", id],
    queryFn: async () => {
      const { data, error } = await platform.from("communities").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useOverview(id: string, enabled = true) {
  return useQuery({
    queryKey: ["platform", "ci-overview", id],
    enabled,
    queryFn: async () => {
      const { data, error } = await platform.rpc("community_overview", { p_community_id: id });
      if (error) throw error;
      return data as unknown as CommunityOverview;
    },
  });
}

export function useParticipants(id: string, enabled = true) {
  return useQuery({
    queryKey: ["platform", "ci-participants", id],
    enabled,
    queryFn: async () => {
      const { data, error } = await platform.rpc("community_participants", { p_community_id: id });
      if (error) throw error;
      return data as unknown as ParticipantRow[];
    },
  });
}

export function useCohorts(id: string) {
  return useQuery({
    queryKey: ["platform", "ci-cohorts", id],
    queryFn: async () => {
      const { data, error } = await platform.rpc("community_cohorts", { p_community_id: id });
      if (error) throw error;
      return data as unknown as Cohort[];
    },
  });
}

export function useJourney(id: string, entrepreneurId: string) {
  return useQuery({
    queryKey: ["platform", "ci-journey", id, entrepreneurId],
    queryFn: async () => {
      const { data, error } = await platform.rpc("community_participant", {
        p_community_id: id, p_entrepreneur_id: entrepreneurId,
      });
      if (error) throw error;
      return data as unknown as Journey;
    },
  });
}

/** The community the signed-in leader runs, if she runs one. */
export function useLedCommunity() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["platform", "led-community", profile?.id],
    enabled: profile?.role === "community_leader",
    queryFn: async () => {
      const { data, error } = await platform
        .from("communities").select("id, name").eq("leader_id", profile!.id).order("created_at").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Logs that the leader reached these participants; each contact counts in cost to serve. */
export function useRecordOutreach(communityId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ids, note }: { action: OutreachAction; ids: string[]; note?: string }) => {
      const { data, error } = await platform.rpc("record_outreach", {
        p_community_id: communityId, p_action: action, p_entrepreneur_ids: ids, p_note: note || undefined,
      });
      if (error) throw error;
      return { n: data as number, action };
    },
    onSuccess: ({ n, action }) => {
      toast.success(`${ACTION[action].label} logged for ${n} participant${n === 1 ? "" : "s"}. Counted in cost to serve.`);
      for (const key of ["ci-overview", "ci-participants", "ci-journey", "ci-cohorts"]) {
        queryClient.invalidateQueries({ queryKey: ["platform", key, communityId] });
      }
    },
    onError: (error) => toast.error(describeError(error)),
  });
}
