import { renderToStaticMarkup } from "react-dom/server";
import Page from "../src/app/territory/page";
async function one(t?: string){
  try {
    const el = await (Page as any)({ searchParams: Promise.resolve(t ? { t } : {}) });
    renderToStaticMarkup(el);
    console.log(`render(${t ?? "default"}) OK`);
  } catch(e){
    console.log(`render(${t ?? "default"}) FAILED: ${(e as Error)?.message}`);
    console.log((e as Error)?.stack?.split("\n").slice(0,8).join("\n"));
  }
}
(async()=>{ for (const t of ["NE","SE","NW","SW","INTL",undefined] as const) await one(t); })().then(()=>process.exit(0)).catch(e=>{console.error("TOP",e);process.exit(1);});
