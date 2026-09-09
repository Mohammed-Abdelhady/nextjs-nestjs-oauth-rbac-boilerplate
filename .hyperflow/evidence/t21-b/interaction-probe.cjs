const {spawn} = require('node:child_process');
const {once} = require('node:events');
const fs = require('node:fs');
const safe = '/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/t29b-safe-jke84nuk';
const {chromium, expect} = require(safe + '/node_modules/@playwright/test');
(async () => {
 const server = spawn(process.execPath, ['e2e/utils/serve-frontend.mjs'], {cwd: safe + '/frontend', stdio: 'pipe'});
 let browser;
 const evidence = {};
 let page;
 try {
  await expect.poll(async () => {try {return (await fetch('http://127.0.0.1:3107/en/auth/login')).status;} catch {return 0;}}, {timeout:10000}).toBe(200);
  browser = await chromium.launch({channel:'chrome',timeout:10000});
  page = await browser.newPage();
  page.setDefaultTimeout(8000);
  evidence.errors=[];page.on('pageerror',error=>evidence.errors.push(error.stack));
  await page.route('**/api/**', route => new URL(route.request().url()).pathname === '/api/auth/methods' ? route.fulfill({json:{success:true,data:{methods:{password:true,magicLink:false,twoFactor:false,passkeys:false,oauth:[]}}}}) : route.abort('blockedbyclient'));
  await page.addInitScript(() => {
   window.probeEvents = [];
   for (const type of ['mousedown','mouseup','click','focusin','focusout']) document.addEventListener(type, event => window.probeEvents.push({type,tag:event.target.tagName,id:event.target.getAttribute('data-testid'),y:event.target.getBoundingClientRect().y,time:performance.now()}),true);
  });
  await page.goto('http://127.0.0.1:3107/en/auth/login');
  await page.getByTestId('signup-link').click();
  await expect(page.getByTestId('register-title')).toBeVisible();
  await page.getByTestId('signin-link').click();
  await expect(page.getByTestId('login-title')).toBeVisible();
  await page.getByTestId('forgot-password-link').click();
  try {await expect(page).toHaveURL(/forgot-password$/, {timeout:1500});} catch {}
  evidence.navigation = await page.evaluate(() => ({url:location.href,events:window.probeEvents}));
  await page.goto('http://127.0.0.1:3107/en/auth/forgot-password');
  await page.getByTestId('forgot-password-submit').click();
  await expect(page.getByTestId('forgot-password-email-input')).toHaveAttribute('aria-invalid','true');
  await page.getByTestId('forgot-password-email-input').fill('invalid-address');
  await page.getByTestId('forgot-password-submit').click();
  await expect(page.getByTestId('forgot-password-email-input')).toHaveAttribute('aria-invalid','true');
  await page.getByTestId('forgot-password-submit').focus();
  await page.keyboard.press('Tab');
  try {await expect(page.getByTestId('back-to-login-link')).toBeFocused({timeout:1500});} catch {}
  evidence.keyboard = await page.evaluate(() => ({focused:document.activeElement.getAttribute('data-testid'),events:window.probeEvents}));
  
 } finally {if(page){evidence.lastPage=await page.content();evidence.finalURL=page.url();}fs.writeFileSync(process.argv[2],JSON.stringify(evidence,null,2));if(browser)await browser.close();server.kill('SIGTERM');await once(server,'exit');console.log('server closed',server.pid);}
})().catch(error=>{console.error(error);process.exitCode=1});
