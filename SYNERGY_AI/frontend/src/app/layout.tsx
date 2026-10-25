import React from "react";
import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Synergy AI - Multi-Agent Content Assistant",
  description: "Create engaging, research-backed, and plagiarism-free articles in seconds with our 4-agent CrewAI system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[var(--color-surface-container-lowest)] font-body-md text-body-md text-[var(--color-on-surface)] min-h-screen">
        {children}
      </body>
    </html>
  );
}
