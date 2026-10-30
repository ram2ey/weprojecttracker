import Image from "next/image";
import Link from "next/link";
import logo from "../../public/brand/wassa-east-logo.png";

export function SiteBrand({
  className = "",
  staff = false,
}: {
  className?: string;
  staff?: boolean;
}) {
  return (
    <Link href="/" className={`constituency-brand ${className}`}>
      <Image
        src={logo}
        alt="Wassa East Constituency"
        className="constituency-logo"
        sizes="(max-width: 600px) 220px, 240px"
        preload
      />
      <span className="constituency-brand-label">
        {staff ? "Staff workspace" : "Project tracker"}
      </span>
    </Link>
  );
}
