import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Mirror tsconfig.json "baseUrl": "src" — Vite doesn't read tsconfig for resolution
const srcDir = path.resolve(__dirname, 'src')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      context:    path.join(srcDir, 'context'),
      components: path.join(srcDir, 'components'),
      pages:      path.join(srcDir, 'pages'),
      hooks:      path.join(srcDir, 'hooks'),
      store:      path.join(srcDir, 'store'),
      config:     path.join(srcDir, 'config'),
      types:      path.join(srcDir, 'types'),
      gen:        path.join(srcDir, 'gen'),
    },
  },
  server: {
    port: 3000,
  },
})
