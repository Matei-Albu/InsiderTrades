"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

export default function FallbackImage({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return <>{fallback}</>;
  return (
    <Image
      src={src}
      alt={alt}
      width={80}
      height={80}
      unoptimized
      className={className}
      // An image that fails before hydration never fires onError, so check on mount too.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setFailedSrc(src);
      }}
      onError={() => setFailedSrc(src)}
    />
  );
}
