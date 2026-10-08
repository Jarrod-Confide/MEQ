import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getViewer } from "@/lib/viewer";

export const metadata: Metadata = {
  title: "MEQ — Member Engagement and Quality",
  description: "Confide member engagement + quality measures",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Signed-out pages (sign-in) render bare; everything else gets the sidebar.
  const viewer = await getViewer().catch(() => null);
  return (
    <html lang="en">
      <body className="m-0 bg-[#0b0f17] text-[#e8edf5] font-sans antialiased">
        {viewer?.email ? (
          <div className="md:flex">
            <Sidebar isAdmin={viewer.isAdmin} who={viewer.staff?.name ?? viewer.email} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
