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
 * Devnet campaigns never show here. Her own campaign's logo used to sit in the
 * header; with several sponsors it moved here.
 */
export default function Sponsors() {
  const list = useQuery({ queryKey: [...PROFILE_KEY, "sponsors"], queryFn: diary.sponsors });

  return (
    <section className="space-y-4 pt-2" aria-labelledby="sponsors-title" aria-busy={list.isLoading}>
      <h1 id="sponsors-title" className="font-heading text-xl font-semibold">
        {tr({ en: "Who supports you", pt: "Quem apoia você" })}
      </h1>

      {list.isLoading && (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="animate-spin" aria-label={tr({ en: "Loading", pt: "Carregando" })} />
        </div>
      )}

      {list.error && (
        <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
          <p>{diaryErrorText(list.error)}</p>
          <Button variant="outline" className="h-11" onClick={() => void list.refetch()}>{tr({ en: "Try again", pt: "Tentar de novo" })}</Button>
        </div>
      )}

      {list.data && list.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <Handshake className="text-muted-foreground" size={28} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {tr({ en: "No sponsor is supporting your campaigns right now.", pt: "Nenhum patrocinador apoiando suas campanhas no momento." })}
          </p>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {list.data.map((s) => {
            const link = s.link_url && SAFE_LINK.test(s.link_url) ? s.link_url : null;
            const body = (
              <>
                <span className="flex h-16 w-full items-center justify-center">
                  {s.logo_path ? (
                    <img src={sponsorLogoUrl(s.logo_path)} alt="" className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="font-heading text-lg font-semibold leading-tight">{s.name}</span>
                  )}
                </span>
                <span className="flex items-center gap-1 text-sm font-medium">
                  {/* Without a logo, the name is already the tile's face. */}
                  {s.logo_path ? s.name : null}
                  {link && <ExternalLink size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                </span>
                {s.campaigns.length > 0 && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">{s.campaigns.join(" · ")}</span>
                )}
              </>
            );
            const tile = "flex h-full min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center";
            return (
              <li key={s.name}>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer sponsored"
                    aria-label={tr({ en: `${s.name} (opens the sponsor's site)`, pt: `${s.name} (abre o site do patrocinador)` })}
                    className={`${tile} transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
                    {body}
                  </a>
                ) : (
                  <div className={tile}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {list.data && list.data.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {tr({
            en: "Sponsors see only group totals, never your name.",
            pt: "Os patrocinadores veem só totais do grupo, nunca o seu nome.",
          })}
        </p>
      )}
    </section>
  );
}
