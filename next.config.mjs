/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads its .afm font metrics files from disk at runtime — bundling
  // it would break that, so it's required normally from node_modules instead.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
