import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error Local development middleware is implemented as a Node ES module.
import poseTrialPlugin from './controller/pose-trial-plugin.mjs'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/R3F-Table-Tennis/',
  plugins: [react(), poseTrialPlugin()],
})
