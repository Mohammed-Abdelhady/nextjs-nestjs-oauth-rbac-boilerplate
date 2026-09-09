import {test,expect} from '/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/production-hardening-integration-4lfc21qz/frontend/e2e/fixtures/authenticated.ts';
import {writeFile} from 'node:fs/promises';
test.use({appLocale:'ar',returnPath:'/sessions',viewport:{width:390,height:844}});
test('SSR and controlled geometry',async({page},info)=>{
 const shell=[];
 for(const locale of ['en','ar']){
  const r=await page.request.get(`http://127.0.0.1:3107/${locale}/auth/login`); const html=await r.text();
  shell.push({locale,status:r.status(),htmlTag:html.match(/<html[^>]*>/)?.[0],form:html.includes('<form'),loading:html.match(/<div[^>]*data-testid="store-rehydration-loading"[^>]*>/)?.[0],bootstrap:html.includes('self.__next_f.push'),scripts:[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(x=>x[1])});
 }
 const capture=()=>page.evaluate(()=>{const main=document.querySelector('[data-testid="dashboard-main"]')!;const header=main.previousElementSibling!;const shell=main.parentElement!;const skip=document.querySelector('[data-testid="skip-to-content-link"]')!;return {viewport:innerWidth,width:document.documentElement.scrollWidth,nodes:[shell,header,skip,...header.children].map(e=>({tag:e.tagName,id:e.getAttribute('data-testid'),rect:e.getBoundingClientRect().toJSON(),minWidth:getComputedStyle(e).minWidth}))}});
 await page.setViewportSize({width:385,height:844}); const before=await capture();await page.screenshot({path:info.outputPath('before.png')});
 await page.evaluate(()=>{const main=document.querySelector('[data-testid="dashboard-main"]')!;(main.parentElement as HTMLElement).style.minWidth='0';});const min=await capture();
 await page.evaluate(()=>{const skip=document.querySelector('[data-testid="skip-to-content-link"]') as HTMLElement;skip.style.insetInlineStart='4px';skip.style.top='4px';});const inset=await capture();
 await page.evaluate(()=>{const header=document.querySelector('[data-testid="dashboard-main"]')!.previousElementSibling as HTMLElement;header.style.flexWrap='wrap';header.style.height='auto';header.style.minHeight='64px';});await page.evaluate(()=>scrollTo(0,0));const wrap=await capture();
 await page.screenshot({path:info.outputPath('controlled-wrap.png')});
 await writeFile(info.outputPath('geometry-ssr.json'),JSON.stringify({shell,before,min,inset,wrap},null,2));expect(shell.every(x=>x.status===200)).toBe(true);
});