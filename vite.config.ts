import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    define: {
      // Safely expose the API_KEY process.env variable to the client
      // Fallback to empty string if undefined to prevent JSON.stringify errors during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY || '')
    },
    build: {
      outDir: 'dist'
    },
    // --- Vercel/Netlify Deployment Guide ---
    // For Vercel/Netlify, no special configuration is typically needed in vite.config.ts
    // as they automatically detect Vite projects and build them.
    //
    // Critical Step: Set the 'API_KEY' environment variable in your Vercel/Netlify project settings.
    // Go to your project dashboard -> Settings -> Environment Variables.
    // Add a new variable with Name: API_KEY and Value: YOUR_GEMINI_API_KEY.
    // This variable will be injected into 'process.env.API_KEY' during the build process.
    // ----------------------------------------
  };
});