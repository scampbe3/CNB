import type { Metadata } from "next";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "The Decision Room | Cupcakes + Broccoli",
    template: "%s | The Decision Room",
  },
  description: "A private advisory community. A place to think together.",
  icons: {
    icon: "/images/cb-icon-white.png",
    shortcut: "/images/cb-icon-white.png",
    apple: "/images/cb-icon-white.png",
  },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
