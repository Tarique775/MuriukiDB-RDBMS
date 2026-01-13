import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { GameStatsProvider } from "@/hooks/useGameStats";
import Index from "./pages/Index";
import Achievements from "./pages/Achievements";
import NotFound from "./pages/NotFound";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <GameStatsProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Toaster position="top-right" />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </GameStatsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
);
