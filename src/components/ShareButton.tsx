import { Share2, Check, Copy } from "lucide-react";
import { useState } from "react";

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  className?: string;
  variant?: "icon" | "button";
}

export function ShareButton({
  url,
  title = "",
  text = "",
  className = "",
  variant = "icon",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareData = { title, text, url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // usuário cancelou ou falhou — segue para fallback
      }
    }

    // Fallback: copiar link
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // último fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (variant === "button") {
    return (
      <button
        onClick={handleShare}
        className={`inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-smooth hover:bg-muted/80 ${className}`}
        aria-label="Compartilhar"
      >
        <Share2 className="h-3.5 w-3.5" />
        {copied ? "Link copiado!" : "Compartilhar"}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-background/90 backdrop-blur shadow-card transition-bounce hover:scale-110 ${className}`}
      aria-label="Compartilhar"
      title={copied ? "Link copiado!" : "Compartilhar loja"}
    >
      {copied ? (
        <Check className="h-5 w-5 text-success" />
      ) : (
        <Share2 className="h-5 w-5" />
      )}
    </button>
  );
}
