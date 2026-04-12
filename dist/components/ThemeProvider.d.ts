import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>;
export declare function ThemeProvider({ children, ...props }: ThemeProviderProps): import("react/jsx-runtime").JSX.Element;
export {};
