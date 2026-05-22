import { Heart } from "lucide-react";
import {
  useFavoriteProductIds,
  useToggleFavoriteProduct,
  useFavoriteStoreIds,
  useToggleFavoriteStore,
  useFavoriteListingIds,
  useToggleFavoriteListing,
} from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export const FavoriteProductButton = ({
  productId,
  storeId,
  className = "",
}: {
  productId: string;
  storeId: string;
  className?: string;
}) => {
  const { user } = useAuth();
  const { data: ids } = useFavoriteProductIds();
  const toggle = useToggleFavoriteProduct();
  const navigate = useNavigate();
  const isFav = !!ids?.has(productId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!user) {
          toast({ description: "Entre para favoritar produtos" });
          navigate("/auth");
          return;
        }
        toggle.mutate({ productId, storeId, isFav });
      }}
      aria-label={isFav ? "Remover dos favoritos" : "Favoritar"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-background/95 backdrop-blur shadow-float transition-all duration-200 hover:scale-110 hover:bg-background hover:shadow-card active:scale-95 ${className}`}
    >
      <Heart
        className={`h-4 w-4 transition-transform ${isFav ? "fill-destructive text-destructive scale-110" : "text-foreground"}`}
        strokeWidth={isFav ? 2.5 : 2.5}
      />
    </button>
  );
};

export const FavoriteStoreButton = ({
  storeId,
  className = "",
}: {
  storeId: string;
  className?: string;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: ids } = useFavoriteStoreIds();
  const toggle = useToggleFavoriteStore();
  const isFav = !!ids?.has(storeId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!user) {
          toast({ description: "Entre para favoritar lojas" });
          navigate("/auth");
          return;
        }
        toggle.mutate({ storeId, isFav });
      }}
      aria-label={isFav ? "Remover loja dos favoritos" : "Favoritar loja"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-card transition-bounce hover:scale-110 ${className}`}
    >
      <Heart className={`h-4 w-4 transition-all duration-200 ${isFav ? "fill-destructive text-destructive scale-110" : "text-foreground"}`} strokeWidth={2.5} />
    </button>
  );
};

export const FavoriteListingButton = ({
  listingId,
  className = "",
}: {
  listingId: string;
  className?: string;
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: ids } = useFavoriteListingIds();
  const toggle = useToggleFavoriteListing();
  const isFav = !!ids?.has(listingId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!user) {
          toast({ description: "Entre para favoritar lojas" });
          navigate("/auth");
          return;
        }
        toggle.mutate({ listingId, isFav });
      }}
      aria-label={isFav ? "Remover loja dos favoritos" : "Favoritar loja"}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-card transition-bounce hover:scale-110 ${className}`}
    >
      <Heart
        className={`h-4 w-4 transition-all duration-200 ${isFav ? "fill-destructive text-destructive scale-110" : "text-foreground"}`}
        strokeWidth={2.5}
      />
    </button>
  );
};
