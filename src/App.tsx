import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import About from "./pages/About.tsx";
import AboutPt from "./pages/AboutPt.tsx";
import Index from "./pages/Index.tsx";
import IndexPt from "./pages/IndexPt.tsx";
import Investors from "./pages/Investors.tsx";
import NotFound from "./pages/NotFound.tsx";
import Privacy from "./pages/Privacy.tsx";
import PrivacyPt from "./pages/PrivacyPt.tsx";
import Terms from "./pages/Terms.tsx";
import TermsPt from "./pages/TermsPt.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* English is the corporate site and lives at the root: it is what an
              investor, a partner or a hackathon judge opens at empowerfi.io. */}
          <Route path="/" element={<Index />} />
          <Route path="/investors" element={<Investors />} />
          <Route path="/about" element={<About />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />

          {/* Portuguese: the entrepreneur-facing product communication. */}
          <Route path="/pt" element={<IndexPt />} />
          <Route path="/pt/sobre" element={<AboutPt />} />
          {/* These two paths are referenced by the Play Store listing and from
              inside the app, so they keep their original URLs. */}
          <Route path="/privacidade" element={<PrivacyPt />} />
          <Route path="/termos" element={<TermsPt />} />

          {/* Where /en/* used to live. Vercel serves 308s for these in
              production (see vercel.json); these keep dev and direct
              client-side navigation working. */}
          <Route path="/en" element={<Navigate to="/" replace />} />
          <Route path="/en/about" element={<Navigate to="/about" replace />} />
          <Route path="/en/privacy" element={<Navigate to="/privacy" replace />} />
          <Route path="/en/terms" element={<Navigate to="/terms" replace />} />

          <Route path="/unsubscribe" element={<Unsubscribe />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
