/** Standard page header: eyebrow + title and an optional right slot. (Navigation is the sidebar.) */
export function PageHeader({
  eyebrow = "MEQ · Member Engagement and Quality",
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3d] bg-[#111726] px-4 py-4 md:px-6">
      <div>
        <div className="text-[12px] uppercase tracking-[0.05em] text-[#9bb0d4]">{eyebrow}</div>
        <h1 className="m-0 text-xl font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
