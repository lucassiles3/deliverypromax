import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { BottomNav } from "@/components/BottomNav";
import { queryClient, persister, shouldPersistQuery } from "@/lib/queryClient";
import Index from "./pages/Index.tsx";
import Store from "./pages/Store.tsx";
import Checkout from "./pages/Checkout.tsx";
import Admin from "./pages/Admin.tsx";
import PDV from "./pages/PDV.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import MyOrders from "./pages/MyOrders.tsx";
import MinhaConta from "./pages/MinhaConta.tsx";
import Enderecos from "./pages/Enderecos.tsx";
import Favoritos from "./pages/Favoritos.tsx";
import Notificacoes from "./pages/Notificacoes.tsx";
import Categorias from "./pages/Categorias.tsx";
import Mesa from "./pages/Mesa.tsx";
import NotFound from "./pages/NotFound.tsx";

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister,
      maxAge: 1000 * 60 * 60 * 24, // 24h
      dehydrateOptions: {
        shouldDehydrateQuery: (q) =>
          q.state.status === "success" && shouldPersistQuery(q.queryKey),
      },
    }}
  >
    <TooltipProvider>
      <CartProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/loja/:slug" element={<Store />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/pdv" element={<PDV />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/meus-pedidos" element={<MyOrders />} />
            <Route path="/conta" element={<MinhaConta />} />
            <Route path="/enderecos" element={<Enderecos />} />
            <Route path="/favoritos" element={<Favoritos />} />
            <Route path="/notificacoes" element={<Notificacoes />} />
            <Route path="/categorias" element={<Categorias />} />
            <Route path="/mesa/:token" element={<Mesa />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CartDrawer />
          <BottomNav />
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
