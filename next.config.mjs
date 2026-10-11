/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit reads its .afm font metrics files from disk at runtime — bundling
  // it would break that, so it's required normally from node_modules instead.
  serverExternalPackages: ["pdfkit"],
  // ...but those reads are dynamic fs/require calls, not static imports, so
  // Next's serverless file-tracer doesn't pick them all up on its own —
  // without this, the PDF export 500s on Vercel (MODULE_NOT_FOUND for a
  // pdfkit font file) while working fine locally, since local dev just
  // reads straight off the real disk. Tracing the .afm data files alone
  // wasn't enough — pdfkit 0.20's standard fonts are also wrapped in their
  // own .cjs/.mjs modules under js/standard-fonts/, so include the whole
  // package rather than guess at its internal layout again.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/**/*"],
  },
};

export default nextConfig;
