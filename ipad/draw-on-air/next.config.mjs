/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.1.154', 'localhost:3000'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;


