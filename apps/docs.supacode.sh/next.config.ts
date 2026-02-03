import nextra from "nextra";
import type { NextConfig } from "next";

const withNextra = nextra({});

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    resolveAlias: {
      "next-mdx-import-source-file": "./mdx-components.tsx",
    },
  },
  images: {
    unoptimized: true,
  },
};

export default withNextra(nextConfig);
