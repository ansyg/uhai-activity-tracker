/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads its .afm font metrics files from disk at runtime — bundling
  // it would break that, so it's required normally from node_modules instead.
  serverExternalPackages: ["pdfkit"],
  // ...but those reads are dynamic fs calls, not static imports, so Next's
  // serverless file-tracer doesn't pick them up on its own — without this,
  // the PDF export 500s on Vercel (ENOENT for the .afm file) while working
  // fine locally, since local dev just reads straight off the real disk.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
