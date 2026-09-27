import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KP-4DSM",
  description: "Painel de monitoramento e alertas de estações meteorológicas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      {/* Extensões do navegador (ex.: ColorZilla) injetam atributos no <body>
          antes da hidratação; sem isso o React acusa divergência de atributos. */}
      <body className="min-h-full flex flex-col font-body" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
