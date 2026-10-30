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
          <p>
            Our communities. Our progress.
            <br />
            An open record of the work that moves us forward.
          </p>
        </div>
        <div className="footer-links">
          <Link href="/projects">
            Explore projects <ArrowUpRight size={14} />
          </Link>
          <Link href="/updates">
            Latest updates <ArrowUpRight size={14} />
          </Link>
          <Link href="/announcements">
            Announcements <ArrowUpRight size={14} />
          </Link>
          <Link href="/reports">
            Public reports <ArrowUpRight size={14} />
          </Link>
          <Link href="/about">
            About this platform <ArrowUpRight size={14} />
          </Link>
          <Link href="/staff/login">
            Staff access <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>Wassa East Constituency · Western Region, Ghana</span>
        <span>Open information. Shared progress.</span>
      </div>
    </footer>
  );
}
