import { createMDX } from "fumadocs-mdx/next";

const nextConfig = {
  output: "export",
  transpilePackages: ["@repo/ui"],
  images: { unoptimized: true },
};

const withMDX = createMDX();
export default withMDX(nextConfig);
