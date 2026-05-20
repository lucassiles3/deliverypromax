import { lazy, Suspense } from "react";

// Auto-reload quando um chunk dinâmico antigo não puder ser carregado (após novo deploy)
if (typeof window !== "undefined") {
  const isChunkLoadError = (msg: string) =>
    /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError/i.test(msg);
  const reloadOnce = () => {
    const key = "__chunk_reloaded_at";
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(key, String(Date.now()));
      window.location.reload();
    }
  };
  window.addEventListener("error", (e) => {
    if (e?.message && isChunkLoadError(e.message)) reloadOnce();
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const msg = (e?.reason?.message || String(e?.reason || "")) as string;
    if (isChunkLoadError(msg)) reloadOnce();
  });
}

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
import { NewOrderAlerts } from "@/components/NewOrderAlerts";
import { OrderReviewPrompt } from "@/components/OrderReviewPrompt";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy: carregadas só quando o usuário acessa a rota
const Store = lazy(() => import("./pages/Store.tsx"));
const Product = lazy(() => import("./pages/Product.tsx"));
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
const Entregador = lazy(() => import("./pages/Entregador.tsx"));
const Recompensas = lazy(() => import("./pages/Recompensas.tsx"));
const Master = lazy(() => import("./pages/Master.tsx"));
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Cadastro = lazy(() => import("./pages/Cadastro.tsx"));

const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
  </div>
);

const PushBridge = () => {
  usePushNotifications();
  return null;
};

/**
 * Carrega o script do Google AdSense uma única vez se VITE_ADSENSE_CLIENT estiver definido.
 * Sem a env var, nada é injetado (banners caem em modo placeholder).
 */
const AdSenseLoader = () => {
  const client = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
  if (typeof window === "undefined" || !client) return null;
  if (document.querySelector('script[data-adsense="1"]')) return null;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  s.crossOrigin = "anonymous";
  s.dataset.adsense = "1";
  document.head.appendChild(s);
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
          <PushBridge />
          <AdSenseLoader />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/loja/:slug" element={<Store />} />
              <Route path="/loja/:slug/produto/:productId" element={<Product />} />
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
              <Route path="/entregador" element={<Entregador />} />
              <Route path="/recompensas" element={<Recompensas />} />
              <Route path="/master" element={<Master />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <CartDrawer />
          <BottomNav />
          <NewOrderAlerts />
          <OrderReviewPrompt />
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
