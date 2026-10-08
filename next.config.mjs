/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The quadrant chart was retired (2026-10-06); its members live on Members.
      { source: "/meq", destination: "/engagement", permanent: false },
    ];
  },
};

export default nextConfig;
