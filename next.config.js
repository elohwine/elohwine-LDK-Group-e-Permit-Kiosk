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
  async rewrites() {
    return [
      // Safety net: map any legacy/capitalized Success.json requests to the canonical file
      { source: "/lottie/Success.json", destination: "/lottie/success.json" },
    ];
  },
});
