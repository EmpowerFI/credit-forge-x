// The e-mail she gets with a reward's link (reward-email, migration
// 20270112000000). Portuguese, because it is hers; plain, with a text part.
// Pure: what goes to Resend is built here, so it can be tested without it.

export interface RewardEmail {
  id: string;
  email: string | null;
  name: string | null;
  title: string;
  how_to_redeem: string | null;
  redeem_url: string | null;
  campaign_name: string;
  sponsor_name: string;
  is_house: boolean;
  threshold_days: number;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** Why she is reading it, in a line: her campaign and who backs it. */
export function because(r: RewardEmail): string {
  const days = r.threshold_days === 1 ? "1 dia" : `${r.threshold_days} dias`;
  return r.is_house
    ? `Você recebeu este e-mail porque ganhou esta recompensa ao registrar ${days} no seu diário da EmpowerFI.`
    : `Você recebeu este e-mail porque ganhou esta recompensa ao registrar ${days} no seu diário, na campanha ${r.campaign_name}, de ${r.sponsor_name}.`;
}

export function rewardEmail(r: RewardEmail): { subject: string; text: string; html: string } {
  if (!r.redeem_url || !/^https:\/\/\S+$/.test(r.redeem_url)) throw new Error("no https link");
  const hello = firstName(r.name) ? `Olá, ${firstName(r.name)}!` : "Olá!";
  const subject = `Sua recompensa: ${r.title}`;
  const how = (r.how_to_redeem ?? "").trim();
  const text = [
    hello,
    "",
    `Você ganhou: ${r.title}.`,
    ...(how ? [how] : []),
    "",
    `Link: ${r.redeem_url}`,
    "",
    because(r),
    "",
    "EmpowerFI",
  ].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:24px;background:#ffffff;color:#1a1a2e;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 0 16px">${escape(hello)}</p>
<p style="margin:0 0 8px">Você ganhou: <strong>${escape(r.title)}</strong>.</p>
${how ? `<p style="margin:0 0 16px">${escape(how)}</p>` : ""}
<p style="margin:24px 0"><a href="${escape(r.redeem_url)}" style="display:inline-block;padding:12px 20px;background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold">Abrir o link</a></p>
<p style="margin:0 0 24px;font-size:14px;word-break:break-all">Se o botão não abrir, copie este endereço: ${escape(r.redeem_url)}</p>
<p style="margin:0 0 16px;font-size:14px;color:#4a4a5a">${escape(because(r))}</p>
<p style="margin:0;font-weight:bold">EmpowerFI</p>
</div>
</body></html>`;
  return { subject, text, html };
}

/** The request to Resend for one e-mail. */
export function resendRequest(apiKey: string, from: string, r: RewardEmail): { url: string; init: RequestInit } {
  if (!r.email) throw new Error("no address");
  const { subject, text, html } = rewardEmail(r);
  return {
    url: "https://api.resend.com/emails",
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `reward-email-${r.id}` },
      body: JSON.stringify({ from, to: [r.email], subject, text, html }),
    },
  };
}

/** Resend's answer: its id when accepted; otherwise an error that names no one. */
export async function outcomeOf(res: Response): Promise<{ id: string | null; error: string | null }> {
  let body: { id?: unknown; name?: unknown; message?: unknown } = {};
  try {
    body = await res.json();
  } catch {
    // not JSON
  }
  if (res.ok && typeof body.id === "string") return { id: body.id, error: null };
  const name = typeof body.name === "string" ? body.name : "error";
  return { id: null, error: `resend ${res.status} ${name}`.slice(0, 200) };
}
