import { describe, expect, it } from "vitest";
import { opensView, roleOpens, toolPath, viewById, viewOf, VIEWS } from "./views";

describe("views: View platform as", () => {
  it("has the five views of the spec, in order", () => {
    expect(VIEWS.map((v) => v.id)).toEqual(["sponsor", "investor", "operator", "community", "entrepreneur"]);
  });

  it("gives each view a demo persona whose role holds it", () => {
    for (const v of VIEWS) expect(v.roles).toContain(v.persona.role);
  });

  it("only lists tools the view's own role opens, so a view never promises what RBAC refuses", () => {
    for (const v of VIEWS) {
      for (const tool of [v.home, ...v.primary, ...v.secondary]) {
        expect(roleOpens(tool, v.persona.role), `${v.id}: ${tool.to}`).toBe(true);
      }
    }
  });

  it("maps each role to the view it holds; admins and auditors hold none", () => {
    expect(viewOf("sponsor")?.id).toBe("sponsor");
    expect(viewOf("capital_provider")?.id).toBe("investor");
    expect(viewOf("partner")?.id).toBe("operator");
    expect(viewOf("community_leader")?.id).toBe("community");
    expect(viewOf("entrepreneur")?.id).toBe("entrepreneur");
    expect(viewOf("admin")).toBeUndefined();
    expect(viewOf("auditor")).toBeUndefined();
  });

  it("does not open another role's view", () => {
    expect(opensView(viewById("investor")!, "sponsor")).toBe(false);
    expect(opensView(viewById("entrepreneur")!, "partner")).toBe(false);
    expect(opensView(viewById("sponsor")!, "admin")).toBe(true);
    expect(opensView(viewById("entrepreneur")!, "admin")).toBe(false);
  });

  it("opens a community tool inside the leader's community, or asks home to find it", () => {
    const tasks = viewById("community")!.primary.find((t) => t.to === "/participants?action=any")!;
    expect(toolPath(tasks, "c1")).toBe("/app/community/c1/participants?action=any");
    expect(toolPath(tasks, null)).toBe("/app?community=%2Fparticipants%3Faction%3Dany");
  });
});
