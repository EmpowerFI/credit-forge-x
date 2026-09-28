import { ExternalLink } from "lucide-react";
import type { Benchmark } from "../../lib/referencePoints";

/**
 * Whose figure this is, and where to go and check it. A number published under
 * someone else's name travels with the name; without it the screen is asserting
 * the number itself, which is exactly what it must not do.
 */
export default function Cite({ b }: { b: Benchmark }) {
  return (
    <a
      href={b.source_url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1 rounded text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {b.source}{b.observed_period ? `, ${b.observed_period}` : ""}
      <ExternalLink size={10} aria-hidden />
    </a>
  );
}
