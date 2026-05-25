import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Store as StoreIcon, Package, Tag, Loader2, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAsset } from "@/lib/assetMap";
import { brl } from "@/lib/format";

type StoreHit = { id: string; slug: string; name: string; cuisine: string | null; logo: string | null };
type ProductHit = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  store: { slug: string; name: string } | null;
};
type PartnerHit = {
  id: string;
  name: string;
  logo: string | null;
  catalog_url: string;
  category_key: string;
};

export const SmartSearch = ({
  onCategoryPick,
}: {
  onCategoryPick?: (cat: string) => void;
}) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<StoreHit[]>([]);
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [partners, setPartners] = useState<PartnerHit[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // debounced search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setStores([]);
      setProducts([]);
      setPartners([]);
      setCuisines([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const [{ data: ss }, { data: pp }, { data: ext }] = await Promise.all([
        supabase
          .from("stores")
          .select("id, slug, name, cuisine, logo")
          .not("owner_id", "is", null)
          .or(`name.ilike.${like},cuisine.ilike.${like}`)
          .limit(5),
        supabase
          .from("products")
          .select("id, name, price, image_url, store:stores!inner(slug, name, owner_id)")
          .ilike("name", like)
          .eq("active", true)
          .not("store.owner_id", "is", null)
          .limit(6),
        supabase
          .from("external_listings")
          .select("id, name, logo, catalog_url, category_key")
          .ilike("name", like)
          .eq("active", true)
          .limit(5),
      ]);
      const sList = (ss ?? []) as StoreHit[];
      setStores(sList);
      setProducts((pp ?? []) as unknown as ProductHit[]);
      setPartners((ext ?? []) as unknown as PartnerHit[]);
      const uniqCui = Array.from(
        new Set(sList.map((s) => s.cuisine).filter((c): c is string => !!c)),
      ).slice(0, 4);
      setCuisines(uniqCui);
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const hasResults = stores.length + products.length + cuisines.length + partners.length > 0;
  const showDropdown = open && q.trim().length >= 2;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (stores[0]) {
      navigate(`/loja/${stores[0].slug}`);
      setOpen(false);
    } else if (partners[0]) {
      window.location.href = partners[0].catalog_url;
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-2xl bg-card p-2 shadow-card ring-1 ring-border focus-within:ring-2 focus-within:ring-primary"
      >
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar lojas, produtos, categorias…"
          className="flex-1 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Limpar"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-popover p-2 shadow-float animate-slide-up">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
            </div>
          )}

          {!loading && !hasResults && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nada encontrado para “{q}”.
            </div>
          )}

          {cuisines.length > 0 && (
            <Section icon={<Tag className="h-3.5 w-3.5" />} title="Categorias">
              <div className="flex flex-wrap gap-1.5 px-2 py-1">
                {cuisines.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onCategoryPick?.(c);
                      setOpen(false);
                    }}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {stores.length > 0 && (
            <Section icon={<StoreIcon className="h-3.5 w-3.5" />} title="Lojas">
              {stores.map((s) => (
                <Link
                  key={s.id}
                  to={`/loja/${s.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg">
                    {s.logo || "🍽️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    {s.cuisine && (
                      <p className="truncate text-xs text-muted-foreground">{s.cuisine}</p>
                    )}
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {partners.length > 0 && (
            <Section icon={<ExternalLink className="h-3.5 w-3.5" />} title="Parceiros locais">
              {partners.map((p) => (
                <a
                  key={p.id}
                  href={p.catalog_url}
                  rel="noopener"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-muted text-lg">
                    {p.logo ? (
                      <img src={p.logo} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      "🤝"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">Parceiro externo</p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </Section>
          )}

          {products.length > 0 && (
            <Section icon={<Package className="h-3.5 w-3.5" />} title="Produtos">
              {products.map((p) => (
                <Link
                  key={p.id}
                  to={p.store ? `/loja/${p.store.slug}` : "/"}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
                >
                  {p.image_url ? (
                    <img
                      src={resolveAsset(p.image_url)}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    {p.store && (
                      <p className="truncate text-xs text-muted-foreground">{p.store.name}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-bold text-primary">
                    {brl(p.price)}
                  </span>
                </Link>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
};

const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mb-1">
    <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
      {icon} {title}
    </div>
    {children}
  </div>
);
