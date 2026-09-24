import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera .next/standalone com um server.js mínimo, usado pela imagem Docker
  // do deploy (frontend/frontend/Dockerfile).
  output: "standalone",
  // Sem isso o Next sobe até frontend/ (que tem outro package-lock.json) e
  // aninha o server.js em .next/standalone/frontend/.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
