/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Don't keep pages in the browser's in-memory router cache, so a changed
    // picture/name shows on the very next navigation instead of after ~30s.
    staleTimes: { dynamic: 0, static: 0 },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      // Only used by lib/mock-data.ts for placeholder avatars — safe to
      // remove once you're pulling real Discord avatar URLs.
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
