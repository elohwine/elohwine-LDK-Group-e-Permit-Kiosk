const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
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
