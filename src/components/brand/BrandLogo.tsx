import Image from "next/image";
import Link from "next/link";
import { assetUrl } from "@/lib/basePath";

export default function BrandLogo({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`}>
      <Image
        src={assetUrl("/brand/statmanac-logo.png")}
        alt="Statmanac"
        width={1528}
        height={360}
        priority
        className="h-12 w-auto sm:h-14"
      />
    </Link>
  );
}
