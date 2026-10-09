import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Terms from "./pages/Terms.tsx";
import CallStudio from "./pages/CallStudio.tsx";
import CallPage from "./pages/CallPage.tsx";
import EventStudio from "./pages/EventStudio.tsx";
import SharedLocationPage from "./pages/SharedLocationPage.tsx";
import SitePageView from "./pages/SitePageView.tsx";
import EmbedVideoPage from "./pages/EmbedVideo.tsx";
import WatchVideo from "./pages/WatchVideo.tsx";
import MagaiAssistant from "./pages/MagaiAssistant.tsx";
import PlusPage from "./pages/PlusPage.tsx";
import LiveStream from "./pages/LiveStream.tsx";
import ScheduledMessagesPump from "@/components/ScheduledMessagesPump";
import { UiSettingsProvider } from "@/hooks/useUiSettings";
import { I18nProvider } from "@/hooks/useI18n";
import { useSiteTextOverrides } from "@/hooks/useSiteTextOverrides";
import AppPermissionsGate from "@/components/AppPermissionsGate";

const queryClient = new QueryClient();

const SiteOverrides = () => {
  useSiteTextOverrides();
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UiSettingsProvider>
    <I18nProvider>
    <TooltipProvider>
      <SiteOverrides />
      <AppPermissionsGate />
      <ScheduledMessagesPump />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/studio/call" element={<CallStudio />} />
          <Route path="/studio/events" element={<EventStudio />} />
          <Route path="/call/:roomId" element={<CallPage />} />
          <Route path="/share/loc/:shareId" element={<SharedLocationPage />} />
          <Route path="/embed/v/:videoId" element={<EmbedVideoPage />} />
          <Route path="/video/watch/:videoId" element={<WatchVideo />} />
          <Route path="/magai" element={<MagaiAssistant />} />
          <Route path="/plus" element={<PlusPage />} />
          <Route path="/membership" element={<PlusPage />} />
          <Route path="/live/:streamId" element={<LiveStream />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          {/* Dynamic site sections and user-created custom slugs (supports nested like /social/videos) */}
          <Route path="/social/videos" element={<SitePageView />} />
          <Route path="/s/*" element={<SitePageView />} />
          <Route path="/:slug" element={<SitePageView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </I18nProvider>
    </UiSettingsProvider>
  </QueryClientProvider>
);

export default App;
