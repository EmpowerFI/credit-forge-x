import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Handshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr } from "../i18n";
import { diary, diaryErrorText, PROFILE_KEY } from "./diary";
import { sponsorLogoUrl } from "./db";

const SAFE_LINK = /^https:\/\/\S+$/;

/**
 * Her sponsors: who supports the real campaigns she is in today, one tile
 * each, the logo opening the page the sponsor named (a new tab, no referrer).
 * Devnet campaigns never show here. Below them, EmpowerFI's strategic partners
 * (20270103), the same for every entrepreneur, with or without a campaign.
 */
export default function Sponsors() {
  const list = useQuery({ queryKey: [...PROFILE_KEY, "sponsors"], queryFn: diary.sponsors });
  const partners = useQuery({ queryKey: [...PROFILE_KEY, "partners"], queryFn: diary.partners });

  return (
    <div className="space-y-8 pt-2">
      <section className="space-y-4" aria-labelledby="sponsors-title" aria-busy={list.isLoading}>
        <h1 id="sponsors-title" className="font-heading text-xl font-semibold">
          {tr({ en: "Who supports you", pt: "Quem apoia você" })}
        </h1>

        {list.isLoading && <Waiting />}
        {list.error && <Failed error={list.error} retry={() => void list.refetch()} />}

        {list.data && list.data.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <Handshake className="text-muted-foreground" size={28} aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {tr({ en: "No sponsor is supporting your campaigns right now.", pt: "Nenhum patrocinador apoiando suas campanhas no momento." })}
            </p>
          </div>
        )}

        {list.data && list.data.length > 0 && (
          <>
            <ul className="grid grid-cols-2 gap-3">
              {list.data.map((s) => (
                <li key={s.name}>
                  <Tile name={s.name} logo={s.logo_path} link={s.link_url} kind="sponsor">
                    {s.campaigns.length > 0 && <span className="line-clamp-2 text-xs text-muted-foreground">{s.campaigns.join(" · ")}</span>}
                  </Tile>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {tr({ en: "Sponsors see only group totals, never your name.", pt: "Os patrocinadores veem só totais do grupo, nunca o seu nome." })}
            </p>
          </>
        )}
      </section>

      {/* Partners show only when there are some: no empty box for something she never asked for. */}
      {(partners.error || (partners.data && partners.data.length > 0)) && (
        <section className="space-y-4" aria-labelledby="partners-title">
          <h2 id="partners-title" className="font-heading text-lg font-semibold">
            {tr({ en: "Strategic partners", pt: "Parceiros estratégicos" })}
          </h2>
          {partners.error && <Failed error={partners.error} retry={() => void partners.refetch()} />}
          {partners.data && (
            <ul className="grid grid-cols-2 gap-3">
              {partners.data.map((p) => (
                <li key={p.name}>
                  <Tile name={p.name} logo={p.logo_path} link={p.link_url} kind="partner">
                    {p.description && <span className="line-clamp-3 text-xs text-muted-foreground">{p.description}</span>}
                  </Tile>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Waiting() {
  return (
    <div className="flex justify-center py-10 text-muted-foreground">
      <Loader2 className="animate-spin" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
    </div>
  );
}

function Failed({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
      <p>{diaryErrorText(error)}</p>
      <Button variant="outline" className="h-11" onClick={retry}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
    </div>
  );
}

/** One sponsor or partner: the logo (or the name), opening its page in a new tab when it has one. */
function Tile({ name, logo, link: raw, kind, children }: {
  name: string; logo: string | null; link: string | null; kind: "sponsor" | "partner"; children?: ReactNode;
}) {
  const link = raw && SAFE_LINK.test(raw) ? raw : null;
  const body = (
    <>
      <span className="flex h-16 w-full items-center justify-center">
        {logo ? (
          <img src={sponsorLogoUrl(logo)} alt="" className="max-h-16 max-w-full object-contain" />
        ) : (
          <span className="font-heading text-lg font-semibold leading-tight">{name}</span>
        )}
      </span>
      <span className="flex items-center gap-1 text-sm font-medium">
        {/* Without a logo, the name is already the tile's face. */}
        {logo ? name : null}
        {link && <ExternalLink size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
      </span>
      {children}
    </>
  );
  const tile = "flex h-full min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center";
  if (!link) return <div className={tile}>{body}</div>;
  return (
    <a href={link} target="_blank" rel={kind === "sponsor" ? "noopener noreferrer sponsored" : "noopener noreferrer"}
      aria-label={kind === "sponsor"
        ? tr({ en: `${name} (opens the sponsor's site)`, pt: `${name} (abre o site do patrocinador)` })
        : tr({ en: `${name} (opens the partner's site)`, pt: `${name} (abre o site do parceiro)` })}
      className={`${tile} transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
      {body}
    </a>
  );
}
