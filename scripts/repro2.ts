async function main(){
  const mod = await import("../src/app/territory/page");
  const Page = mod.default;
  for (const t of ["NE","INTL", undefined] as const) {
    try {
      await (Page as any)({ searchParams: Promise.resolve(t ? { t } : {}) });
      console.log(`render(${t ?? "default"}) OK`);
    } catch(e){ console.log(`render(${t ?? "default"}) FAILED:`, (e as Error)?.message); console.log((e as Error)?.stack?.split("\n").slice(0,6).join("\n")); }
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error("TOP-LEVEL:", e); process.exit(1);});
