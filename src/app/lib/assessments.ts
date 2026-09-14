import { platform } from "./platform";
import type { STATUS_LABEL } from "./readiness";

/** Asks the server to run the readiness engine; the result is recorded there. */
export async function requestAssessment(entrepreneurId: string) {
  const { data, error } = await platform.functions.invoke("readiness-evaluate", {
    body: { entrepreneur_id: entrepreneurId },
  });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? error.message);
  }
  return data as { assessment_no: number; reused: boolean; result: { status: keyof typeof STATUS_LABEL } };
}
