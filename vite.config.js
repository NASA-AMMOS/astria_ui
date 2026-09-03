/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { defineConfig } from 'vite';
import { patchCssModules } from 'vite-css-modules';

// https://vitejs.dev/config/

const build = process.env.VITE_BUILD === 'true';
const disableHttps = process.env.ASTRIA_DEV_HTTPS === 'false';

// Only import certificates if we are not running the build since that could occur in CI
// where self signed certs are not used
const https = !build && !disableHttps
  ? {
      https: {
        key: fs.readFileSync('./.cert/key.pem'),
        cert: fs.readFileSync('./.cert/cert.pem'),
      },
    }
  : null;

export default defineConfig({
  plugins: [patchCssModules(), react()],
  resolve: {
    alias: {
      'config.js': '/configs/config.js',
      src: '/src',
    },
  },
  server: {
    port: process.env.ASTRIA_UI_PORT || 3000,
    hmr: false,
    ...https,
  },
  preview: {
    port: process.env.ASTRIA_UI_PORT || 3000,
    ...https,
  },
  define: {
    'process.env.ASTRIA_APP_VERSION': JSON.stringify(process.env.npm_package_version),
    'process.env.APP_ACCOUNT_PASS': JSON.stringify(process.env.APP_ACCOUNT_PASS),
    'process.env.APP_ACCOUNT_USER': JSON.stringify(process.env.APP_ACCOUNT_USER),
    'process.env.CSSO_ENDPOINT_URL': JSON.stringify(process.env.CSSO_ENDPOINT_URL),
    'process.env.ASTRIA_BUILD_HASH': JSON.stringify(process.env.ASTRIA_BUILD_HASH),
    'process.env.ASTRIA_PUBLIC_URL_PATH': JSON.stringify(process.env.ASTRIA_PUBLIC_URL_PATH),
  },
});
