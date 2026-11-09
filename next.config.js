/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Sample media is served from /public and exported sites are plain files, so
  // there is no image optimizer to call. See ROADMAP for a hosting adapter.
  images: { unoptimized: true },
}

module.exports = nextConfig
