import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/storePage/:path*", destination: "/restaurants/:path*", permanent: true },
      { source: "/trackorderPage", destination: "/orders", permanent: true },
      { source: "/cartPage", destination: "/cart", permanent: true },
      { source: "/viewProfile", destination: "/profile", permanent: true },
      { source: "/editPage", destination: "/profile/edit", permanent: true },
      { source: "/aboutusPage", destination: "/about", permanent: true },
      { source: "/contactPage", destination: "/contact", permanent: true },
      { source: "/privacypolicyPage", destination: "/privacy-policy", permanent: true },
      { source: "/termsofusePage", destination: "/terms-of-use", permanent: true },
    ];
  },
};

export default nextConfig;
