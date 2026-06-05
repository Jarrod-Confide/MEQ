import * as React from "react";
(globalThis as any).React = React;
import { renderToStaticMarkup } from "react-dom/server";
async function one(t?: string){
  try {
    const mod = await import("../src/app/territory/page");
    const el = await (mod.default as any)({ searchParams: Promise.resolve(t ? { t } : {}) });
    renderToStaticMarkup(el);
    console.log(`render(${t ?? "default"}) OK`);
  } catch(e){
    console.log(`render(${t ?? "default"}) FAILED: ${(e as Error)?.message}`);
    console.log((e as Error)?.stack?.split("\n").slice(0,10).join("\n"));
  }
}
(async()=>{ for (const t of ["NE","SE","NW","SW","INTL",undefined] as const) await one(t); })().then(()=>process.exit(0));
