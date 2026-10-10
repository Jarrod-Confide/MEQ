/** @type {import('next').NextConfig} */

// MEQ now lives inside MemberHub at members.thecisosociety.com/meq (MemberHub proxies /meq/*
// here). Pages are served under /meq; meq.confide.group page visits redirect there.
const MEMBERHUB = "https://members.thecisosociety.com";

const nextConfig = {
  basePath: "/meq",
  // API callers (EventFlow member-stats feed, Heartbeat health check, Vercel crons) keep using
  // meq.confide.group/api/... unchanged: vercel.json rewrites /api/* to /meq/api/* in place.
  // Not redirected: a cross-site redirect would drop their Authorization header.
  async redirects() {
    return [
      // Old bookmarks to meq.confide.group pages -> the same page inside MemberHub.
      {
        source: "/:path((?!api/|_next/|meq(?:/|$)).*)",
        has: [{ type: "host", value: "meq.confide.group" }],
        destination: `${MEMBERHUB}/meq/:path`,
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
