import { lazy, Suspense } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { BottomNav } from "@/components/BottomNav";
import { queryClient, persister, shouldPersistQuery } from "@/lib/queryClient";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy: carregadas só quando o usuário acessa a rota
const Store = lazy(() => import("./pages/Store.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const PDV = lazy(() => import("./pages/PDV.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const MyOrders = lazy(() => import("./pages/MyOrders.tsx"));
const OrderDetails = lazy(() => import("./pages/OrderDetails.tsx"));
const MinhaConta = lazy(() => import("./pages/MinhaConta.tsx"));
const Enderecos = lazy(() => import("./pages/Enderecos.tsx"));
const Favoritos = lazy(() => import("./pages/Favoritos.tsx"));
const Notificacoes = lazy(() => import("./pages/Notificacoes.tsx"));
const Categorias = lazy(() => import("./pages/Categorias.tsx"));
const Mesa = lazy(() => import("./pages/Mesa.tsx"));

const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
  </div>
);

const PushBridge = () => {
  usePushNotifications();
  return null;
};

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
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/loja/:slug" element={<Store />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/pdv" element={<PDV />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/meus-pedidos" element={<MyOrders />} />
              <Route path="/meus-pedidos/:id" element={<OrderDetails />} />
              <Route path="/conta" element={<MinhaConta />} />
              <Route path="/enderecos" element={<Enderecos />} />
              <Route path="/favoritos" element={<Favoritos />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/categorias" element={<Categorias />} />
              <Route path="/mesa/:token" element={<Mesa />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CartDrawer />
          <BottomNav />
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
