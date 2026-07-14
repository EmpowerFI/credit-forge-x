import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * React Router keeps the scroll position across route changes, so navigating
 * from the bottom of the home page to /about would land mid-document. Hash
 * links are left alone — those are in-page anchors doing their own scrolling.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
