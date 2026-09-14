import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

/** The corporate site's door into the product: the same brand, the platform's workspaces. */
const LaunchAppButton = ({ label = "Launch App" }: { label?: string }) => (
  <Link
    to="/app/login"
    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
  >
    {label} <ArrowUpRight size={15} aria-hidden />
  </Link>
);

export default LaunchAppButton;
