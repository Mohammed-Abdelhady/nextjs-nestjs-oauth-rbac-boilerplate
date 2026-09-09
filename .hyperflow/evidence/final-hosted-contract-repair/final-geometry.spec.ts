import {test,expect} from '/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/production-hardening-integration-4lfc21qz/frontend/e2e/fixtures/authenticated.ts';
import {writeFile} from 'node:fs/promises';
for(const locale of ['en','ar'] as const){
 test.describe(locale,()=>{
  test.use({appLocale:locale,returnPath:'/sessions'});
  test('final geometry and320 observation',async({page},info)=>{
   const widths=[];
   for(const width of [1280,390,385,320]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>document.documentElement.scrollTo(0,0));
    const geometry=await page.evaluate(()=>{
     const main=document.querySelector('[data-testid="dashboard-main"]')!;const header=main.previousElementSibling!;
     const refresh=document.querySelector('[data-testid="refresh-sessions-button"]')!;
     const nodes=[main.parentElement!,header,...header.children,document.querySelector('[data-testid="skip-to-content-link"]')!,document.querySelector('[data-testid="sessions-page"]')!,refresh.parentElement!,...refresh.parentElement!.children];
     return {viewport:innerWidth,document:document.documentElement.scrollWidth,dir:document.documentElement.dir,nodes:nodes.map(e=>({tag:e.tagName,id:e.getAttribute('data-testid'),rect:e.getBoundingClientRect().toJSON(),minWidth:getComputedStyle(e).minWidth,flexWrap:getComputedStyle(e).flexWrap}))};
    });widths.push(geometry);
    if(width>=385)expect(geometry.document).toBeLessThanOrEqual(width);
    await page.screenshot({path:info.outputPath(`${locale}-${width}.png`)});
   }
   await writeFile(info.outputPath('geometry.json'),JSON.stringify(widths,null,2));
  });
 });
}
