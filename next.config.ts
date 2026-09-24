import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Contract attachments are uploaded through a Server Action (default limit 1 MB).
    // Matches MAX_ATTACHMENT_BYTES in src/lib/attachments.ts plus multipart overhead.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
