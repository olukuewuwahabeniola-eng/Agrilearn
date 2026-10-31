import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Scrolls to top on forward navigations.
 * Skips POP (browser/app back) so previous scroll can be restored when possible.
 */
function ScrollToTop() {
  const { pathname, search } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, search, navigationType]);

  return null;
}

export default ScrollToTop;
