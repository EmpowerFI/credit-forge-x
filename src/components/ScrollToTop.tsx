import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router keeps the scroll position across route changes, so navigating
 * from the bottom of the home page to /about would land mid-document.
 *
 * Hash links get scrolled here too rather than by the browser: the nav points at
 * "/#impact" from every page, and on a client-side navigation the target element
 * does not exist yet when the browser would normally jump to it.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    // The element belongs to the route we are navigating *to*, so wait for it
    // to paint before scrolling.
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo(0, 0);
    });

    return () => cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
