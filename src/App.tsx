import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import BoutiqueDetail from "./pages/BoutiqueDetail";
import GlobalStockList from "./pages/GlobalStockList";
import ImportStock from "./pages/ImportStock";
import StockBalancing from "./pages/StockBalancing";
import Login from "./pages/Login";
import TestDeDonnees from "./pages/TestDeDonnees"; // Import de la nouvelle page
import { AppLayout } from "./components/layout/AppLayout";
import { SessionContextProvider } from "./components/auth/SessionContextProvider";
import AdminRouteWrapper from "./components/auth/AdminRouteWrapper";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SessionContextProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Index />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="reports" element={<Reports />} />
              <Route path="boutique-detail" element={<BoutiqueDetail />} />
              <Route path="global-stock" element={<GlobalStockList />} />
              <Route path="test-de-donnees" element={<TestDeDonnees />} /> {/* Nouvelle route */}
              {/* Routes protégées par AdminRouteWrapper */}
              <Route element={<AdminRouteWrapper />}>
                <Route path="import-stock" element={<ImportStock />} />
                <Route path="stock-balancing" element={<StockBalancing />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;