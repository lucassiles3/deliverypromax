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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  PageFallback,
  StoreFallback,
  CheckoutFallback,
  AccountFallback,
} from "@/components/RouteFallbacks";

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
const AdminListings = lazy(() => import("./pages/AdminListings.tsx"));
const Sobre = lazy(() => import("./pages/Sobre.tsx"));
const Termos = lazy(() => import("./pages/Termos.tsx"));
const Privacidade = lazy(() => import("./pages/Privacidade.tsx"));

/** Atalho: envolve um elemento em Suspense com fallback dedicado. */
const withFallback = (node: React.ReactNode, fallback: React.ReactNode) => (
  <Suspense fallback={fallback}>{node}</Suspense>
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
          <ErrorBoundary label="routes">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/loja/:slug" element={withFallback(<Store />, <StoreFallback />)} />
                <Route path="/loja/:slug/produto/:productId" element={withFallback(<Product />, <StoreFallback />)} />
                <Route path="/checkout" element={withFallback(<Checkout />, <CheckoutFallback />)} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/admin/parceiros" element={<AdminListings />} />
                <Route path="/pdv" element={<PDV />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/meus-pedidos" element={withFallback(<MyOrders />, <AccountFallback />)} />
                <Route path="/meus-pedidos/:id" element={withFallback(<OrderDetails />, <AccountFallback />)} />
                <Route path="/conta" element={withFallback(<MinhaConta />, <AccountFallback />)} />
                <Route path="/enderecos" element={withFallback(<Enderecos />, <AccountFallback />)} />
                <Route path="/favoritos" element={withFallback(<Favoritos />, <AccountFallback />)} />
                <Route path="/notificacoes" element={withFallback(<Notificacoes />, <AccountFallback />)} />
                <Route path="/categorias" element={<Categorias />} />
                <Route path="/mesa/:token" element={<Mesa />} />
                <Route path="/entregador" element={<Entregador />} />
                <Route path="/recompensas" element={withFallback(<Recompensas />, <AccountFallback />)} />
                <Route path="/master" element={<Master />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/cadastro" element={<Cadastro />} />
                <Route path="/sobre" element={<Sobre />} />
                <Route path="/termos" element={<Termos />} />
                <Route path="/privacidade" element={<Privacidade />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          <CartDrawer />
          <BottomNav />
          <ErrorBoundary label="new-order-alerts" fallback={null}>
            <NewOrderAlerts />
          </ErrorBoundary>
          <ErrorBoundary label="review-prompt" fallback={null}>
            <OrderReviewPrompt />
          </ErrorBoundary>
        </BrowserRouter>
      </CartProvider>
    </TooltipProvider>
  </PersistQueryClientProvider>
);

export default App;
