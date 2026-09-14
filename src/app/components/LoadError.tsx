import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeError } from "../lib/errors";

/** What a page shows when its data did not load: why, in words, and a way to try again. */
export default function LoadError({ error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 ${compact ? "p-4" : "p-5"}`}>
      <AlertTriangle size={20} className="mt-0.5 shrink-0" />
      <div className="space-y-2">
        <p className="text-sm">{describeError(error)}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 border-amber-300 bg-white/60 text-amber-900 hover:bg-white">
            <RotateCw size={14} /> Try again
          </Button>
        )}
      </div>
    </div>
  );
}
