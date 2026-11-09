import Image from "next/image";

const socialLinks = [
  { name: "Facebook", icon: "facebook", href: "https://www.facebook.com/" },
  { name: "Instagram", icon: "instagram", href: "https://www.instagram.com/" },
  { name: "X", icon: "x", href: "https://x.com/" },
  { name: "YouTube", icon: "youtube", href: "https://www.youtube.com/" },
  { name: "TikTok", icon: "tiktok", href: "https://www.tiktok.com/" },
];

export function SocialLinks() {
  return (
    <nav className="social-links" aria-label="Social media">
      {socialLinks.map(({ name, icon, href }) => (
        <a
          key={icon}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={name + " (opens in a new tab)"}
        >
          <Image
            src={"/brand/" + icon + ".svg"}
            width={18}
            height={18}
            alt=""
          />
        </a>
      ))}
    </nav>
  );
}
