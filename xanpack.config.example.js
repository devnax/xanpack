import xanpack from "./dist/functions/xanpack.js";

/**
 * Example Xanpack Configuration
 *
 * This file demonstrates the available options for configuring xanpack.
 * Copy and modify this file for your project.
 */

export default {
  // Input file or files to bundle
  // Can be a string, array, or object with named entry points
  input: "src/index.ts",

  // Output configuration
  output: {
    // Output directory (required)
    dir: "dist",

    // Output format: 'esm' or 'cjs'
    // Default: 'esm'
    format: "esm",

    // Minify the output
    // Default: false
    minify: process.env.NODE_ENV === "production",

    // Generate source maps
    // Default: false
    sourcemap: process.env.NODE_ENV !== "production",

    // Custom entry file names
    // entryFileNames: '[name].js',

    // Custom chunk file names
    // chunkFileNames: '[name]-[hash].js',

    // Custom asset file names
    // assetFileNames: 'assets/[name]-[hash][extname]',
  },

  // Transform options (TypeScript, JSX, etc)
  transform: {
    // Define global variables
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV === "development"),
      __VERSION__: JSON.stringify(process.env.npm_package_version),
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development",
      ),
    },

    // Target environment/version
    // target: 'es2020',

    // JSX configuration
    // jsx: 'preserve' | { automatic: true }

    // TypeScript configuration
    // typescript: { /* ... */ }
  },

  // Plugin system for extending functionality
  plugins: [
    // Example plugin
    // {
    //   name: 'custom-plugin',
    //   resolveId(source, importer) {
    //     // Custom module resolution
    //   },
    //   load(id) {
    //     // Custom module loading
    //   },
    //   transform(code, id) {
    //     // Transform code
    //   }
    // }
  ],

  // Enable debug logging
  debug: process.env.DEBUG === "true",
};
