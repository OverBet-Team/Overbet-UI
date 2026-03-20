// Type declarations for direct lucide-react ESM icon imports.
// Required because lucide-react only ships a top-level .d.ts, not per-icon declarations.
// Using optimizePackageImports in next.config is the alternative; this avoids that config change.
declare module "lucide-react/dist/esm/icons/*";
