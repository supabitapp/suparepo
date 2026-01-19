"use client";

import type { ComponentProps } from "react";
import { ThemeProvider } from "next-themes";

type ThemeProviderProps = ComponentProps<typeof ThemeProvider>;

function AppThemeProvider(props: ThemeProviderProps) {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem {...props} />;
}

export { AppThemeProvider };
