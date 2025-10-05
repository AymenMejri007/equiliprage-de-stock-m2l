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
import StockBalancing from "./pages/StockBalancing"; // Importez la nouvelle page
import { AppLayout } from "./components/layout/AppLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Index />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="reports" element={<Reports />} />
            <Route path="boutique-detail" element={<BoutiqueDetail />} />
            <Route path="global-stock" element={<GlobalStockList />} />
            <Route path="import-stock" element={<ImportStock />} />
            <Route path="stock-balancing" element={<StockBalancing />} /> {/* Nouvelle route */}
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;