import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MEQ — Member Engagement and Quality",
  description: "Confide member engagement + quality measures",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="m-0 bg-[#0b0f17] text-[#e8edf5] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
