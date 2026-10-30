import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteBrand } from "./site-brand";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <SiteBrand className="footer-brand" />
        </div>
        <div className="footer-links">
          <Link href="/projects">
            Projects <ArrowUpRight size={14} />
          </Link>
          <Link href="/updates">
            Updates <ArrowUpRight size={14} />
          </Link>
          <Link href="/announcements">
            Announcements <ArrowUpRight size={14} />
          </Link>
          <Link href="/reports">
            Reports <ArrowUpRight size={14} />
          </Link>
          <Link href="/about">
            About <ArrowUpRight size={14} />
          </Link>
          <Link href="/staff/login">
            Staff access <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>Wassa East Constituency · Western Region, Ghana</span>
      </div>
    </footer>
  );
}
