import Image from "next/image";

interface StockLogoProps {
  symbol: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}

export function StockLogo({
  symbol,
  logoUrl,
  size = 40,
  className = "",
}: StockLogoProps) {
  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center rounded-lg bg-default-100 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {logoUrl ? (
        <Image
          alt={symbol}
          className="object-cover w-full h-full"
          height={size}
          src={logoUrl}
          width={size}
          onError={(e) => {
            // Fallback to symbol text if image fails to load
            e.currentTarget.style.display = "none";
            if (e.currentTarget.nextElementSibling) {
              (e.currentTarget.nextElementSibling as HTMLElement).style.display =
                "flex";
            }
          }}
        />
      ) : null}
      <span
        className="text-xs font-bold text-default-600"
        style={{ display: logoUrl ? "none" : "flex" }}
      >
        {symbol.substring(0, 2)}
      </span>
    </div>
  );
}
