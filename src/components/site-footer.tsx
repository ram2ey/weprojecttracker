import Link from "next/link";
import { ArrowUpRight, Landmark } from "lucide-react";
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <div className="footer-brand">
            <Landmark size={25} /> Wassa East Projects
          </div>
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
