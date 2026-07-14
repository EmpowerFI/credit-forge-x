import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import About from "./pages/About.tsx";
import AboutEn from "./pages/AboutEn.tsx";
import Index from "./pages/Index.tsx";
import IndexEn from "./pages/IndexEn.tsx";
import NotFound from "./pages/NotFound.tsx";
import Privacy from "./pages/Privacy.tsx";
import PrivacyEn from "./pages/PrivacyEn.tsx";
import Terms from "./pages/Terms.tsx";
import TermsEn from "./pages/TermsEn.tsx";
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
          <Route path="/" element={<Index />} />
          <Route path="/en" element={<IndexEn />} />
          <Route path="/about" element={<About />} />
          <Route path="/en/about" element={<AboutEn />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="/termos" element={<Terms />} />
          <Route path="/en/privacy" element={<PrivacyEn />} />
          <Route path="/en/terms" element={<TermsEn />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
