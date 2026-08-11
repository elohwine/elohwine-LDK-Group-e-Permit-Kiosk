const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  buildExcludes: [/middleware-manifest\.json$/],
  swSrc: 'service-worker.js', // use custom SW with workbox features
});

module.exports = withPWA({
  reactStrictMode: true,
  images: { loader: 'akamai', path: '/' },
  async rewrites() {
    return [
      // Proxy all /backend-api/* requests to the real backend to avoid CORS
      {
        source: "/backend-api/:path*",
        destination: "https://www.ldkgroup.co.uk/api/:path*",
      },
      // Safety net: map any legacy/capitalized Success.json requests to the canonical file
      { source: "/lottie/Success.json", destination: "/lottie/success.json" },
      // Icon fallbacks to prevent 404 during packaging/builders
      { source: "/icons/icon-512-maskable.png", destination: "/icons/icon-512.png" },
      { source: "/icons/icon-192-maskable.png", destination: "/icons/icon-192.png" },
      { source: "/icons/shortcut-96.png", destination: "/icons/icon-192.png" },
    ];
  },
});
