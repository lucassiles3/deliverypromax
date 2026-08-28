import { Heart, Loader2, Store as StoreIcon, Package } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFavoriteProducts, useFavoriteStores, useFavoriteListings } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";

const Favoritos = () => {
  const { user, loading } = useAuth();
  const { data: products = [], isLoading: lp } = useFavoriteProducts();
  const { data: stores = [], isLoading: ls } = useFavoriteStores();
  const { data: listings = [], isLoading: ll } = useFavoriteListings();

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container py-6">
        <div className="mb-6 flex items-center gap-2">
          <Heart className="h-6 w-6 fill-destructive text-destructive" />
          <h1 className="font-display text-2xl font-bold md:text-3xl">Favoritos</h1>
        </div>

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products"><Package className="mr-1.5 h-4 w-4" /> Produtos</TabsTrigger>
            <TabsTrigger value="stores"><StoreIcon className="mr-1.5 h-4 w-4" /> Lojas</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            {lp ? (
              <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
            ) : products.length === 0 ? (
              <EmptyState text="Você ainda não favoritou nenhum produto." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((f: any) => (
                  <Link
                    key={f.id}
                    to={`/loja/${f.stores?.slug ?? ""}`}
                    className="flex gap-3 rounded-2xl bg-card p-3 shadow-soft hover:shadow-card transition-smooth"
                  >
                    {f.products?.image_url && (
                      <img
                        src={f.products.image_url}
                        alt=""
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{f.stores?.logo} {f.stores?.name}</p>
                      <h3 className="font-display font-semibold leading-tight truncate">{f.products?.name}</h3>
                      <p className="mt-1 font-display text-base font-bold text-primary">
                        R$ {Number(f.products?.price ?? 0).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stores" className="mt-4">
            {ls || ll ? (
              <Loader2 className="mx-auto my-12 h-6 w-6 animate-spin text-primary" />
            ) : stores.length === 0 && listings.length === 0 ? (
              <EmptyState text="Você ainda não favoritou nenhuma loja." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stores.map((f: any) => (
                  <Link
                    key={f.id}
                    to={`/loja/${f.stores?.slug ?? ""}`}
                    className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft hover:shadow-card transition-smooth"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-3xl">
                      {f.stores?.logo ?? "🏪"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold truncate">{f.stores?.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{f.stores?.tagline}</p>
                    </div>
                  </Link>
                ))}
                {listings.map((f: any) => {
                  const l = f.external_listings;
                  if (!l) return null;
                  const isUrl = typeof l.logo === "string" && /^https?:\/\//i.test(l.logo);
                  return (
                    <a
                      key={f.id}
                      href={l.catalog_url}
                      rel="noopener"
                      className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft hover:shadow-card transition-smooth"
                    >
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-muted text-3xl">
                        {isUrl ? (
                          <img src={l.logo} alt={l.name} className="h-full w-full object-cover" />
                        ) : (
                          l.logo ?? "🏪"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold truncate">{l.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{l.address ?? "Parceiro"}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
    <Heart className="mx-auto mb-3 h-8 w-8 opacity-40" />
    {text}
  </div>
);

export default Favoritos;
