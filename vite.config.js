import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const useLocalProxy = env.VITE_DEV_PROXY_LOCAL === 'true'

  return {
    root: projectRoot,
    envDir: projectRoot,
    plugins: [react()],
    server: {
      ...(useLocalProxy
        ? {
            proxy: {
              '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
  }
})
