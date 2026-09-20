import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // engine / templates 以 TS 源码形式发布，需要 Next 转译
  transpilePackages: ['@starjack/engine', '@starjack/templates'],
};

export default nextConfig;
