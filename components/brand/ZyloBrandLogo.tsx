"use client";

import Image from "next/image";

type ZyloBrandLogoProps = {
  mode?: "auto" | "horizontal" | "mark";
  className?: string;
  markClassName?: string;
};

export default function ZyloBrandLogo({
  mode = "auto",
  className = "",
  markClassName = "",
}: ZyloBrandLogoProps) {
  const alt = "Zylo-Buylo - Buy Smart, Sell Easy";

  if (mode === "mark") {
    return (
      <Image
        src="/zylo-logo-mark.svg"
        alt={alt}
        width={44}
        height={44}
        priority
        className={`h-10 w-10 shrink-0 ${markClassName || className}`}
      />
    );
  }

  if (mode === "horizontal") {
    return (
      <Image
        src="/zylo-logo-horizontal.svg"
        alt={alt}
        width={180}
        height={48}
        priority
        className={`h-12 w-auto shrink-0 ${className}`}
      />
    );
  }

  return (
    <>
      <Image
        src="/zylo-logo-mark.svg"
        alt={alt}
        width={44}
        height={44}
        priority
        className={`h-10 w-10 shrink-0 sm:hidden ${markClassName}`}
      />
      <Image
        src="/zylo-logo-horizontal.svg"
        alt={alt}
        width={180}
        height={48}
        priority
        className={`hidden h-12 w-auto shrink-0 sm:block ${className}`}
      />
    </>
  );
}
