import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const version=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8')).version
const revision=process.env.GITHUB_SHA?.slice(0,7)||(()=>{try{return execFileSync('git',['rev-parse','--short','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch{return 'local'}})()
// @ts-expect-error Local development middleware is implemented as a Node ES module.
import poseTrialPlugin from './controller/pose-trial-plugin.mjs'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/R3F-Table-Tennis/',
  optimizeDeps: { include: ['@mediapipe/tasks-vision', 'jsqr'] },
  define:{__APP_VERSION__:JSON.stringify(version),__BUILD_SHA__:JSON.stringify(revision)},
  plugins: [react(), poseTrialPlugin()],
})
