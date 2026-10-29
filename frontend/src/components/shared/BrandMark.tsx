interface BrandMarkProps {
  className?: string;
  src?: string | null;
  alt?: string;
}

export default function BrandMark({
  className = "h-10 w-10",
  src = "/atelier-mark.png",
  alt = "",
}: BrandMarkProps) {
  if (!src) {
    return (
      <span
        aria-hidden={alt ? undefined : "true"}
        className={`flex flex-none items-center justify-center rounded-full bg-[var(--brand-primary,#8F4E34)] font-heading font-semibold text-white ${className}`}
      >
        {alt.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : "true"}
      className={`flex-none object-contain ${className}`}
    />
  );
}
