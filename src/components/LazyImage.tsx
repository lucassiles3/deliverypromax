import { useState, type ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: string;
};

/**
 * Imagem otimizada:
 * - loading="lazy" + decoding="async" por padrão
 * - fade-in suave ao carregar (sem layout shift)
 * - placeholder com bg-muted enquanto carrega
 * - troca para fallback se a URL falhar
 */
export const LazyImage = ({
  className = "",
  fallback = "/placeholder.svg",
  onLoad,
  onError,
  ...props
}: Props) => {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <img
      {...props}
      src={errored ? fallback : props.src}
      loading={props.loading ?? "lazy"}
      decoding={props.decoding ?? "async"}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setErrored(true);
        onError?.(e);
      }}
      className={`${className} ${loaded ? "opacity-100" : "opacity-0"} bg-muted transition-opacity duration-300`}
    />
  );
};
