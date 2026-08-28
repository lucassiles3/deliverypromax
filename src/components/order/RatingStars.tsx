import { Star } from "lucide-react";

export const RatingStars = ({
  value,
  onChange,
  size = 24,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`transition-transform ${readOnly ? "" : "hover:scale-110"} ${
            readOnly ? "cursor-default" : "cursor-pointer"
          }`}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}
          />
        </button>
      ))}
    </div>
  );
};
