import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./lab/tests', timeout:120_000, expect:{timeout:20_000}, workers:1,
 outputDir:'lab-results', reporter:[['list'],['html',{outputFolder:'lab-report',open:'never'}]],
 use:{baseURL:'http://127.0.0.1:5190/R3F-Table-Tennis/',viewport:{width:1280,height:800},video:'on',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']}},
 webServer:[{command:'npm run lab:runner',url:'http://127.0.0.1:5191',reuseExistingServer:!process.env.CI,timeout:30000},{command:'npm run pose:prepare && npm run dev -- --host 127.0.0.1 --port 5190 --strictPort',url:'http://127.0.0.1:5190/R3F-Table-Tennis/',reuseExistingServer:!process.env.CI,timeout:120_000},{command:'CONTROLLER_HTTP_PORT=8789 CONTROLLER_HTTPS_PORT=8790 npm run controller',url:'http://127.0.0.1:8789/controller.html',reuseExistingServer:!process.env.CI,timeout:30_000}],
});
