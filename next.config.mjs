/** @type {import('next').NextConfig} */
const nextConfig = {
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
