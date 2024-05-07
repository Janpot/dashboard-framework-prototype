"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppNavigationProvider } from "@toolpad/dashboard/next-app";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./theme";
import { DialogProvider } from "@/lib/dash/useDialogs";
import { NotificationsProvider } from "@/lib/dash/useNotifications";

const queryClient = new QueryClient();

interface ProviderProps {
  children?: React.ReactNode;
}

export default function Providers({ children }: ProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <AppNavigationProvider>
        <DialogProvider>
          <NotificationsProvider>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <QueryClientProvider client={queryClient}>
                {children}
              </QueryClientProvider>
            </LocalizationProvider>
          </NotificationsProvider>
        </DialogProvider>
      </AppNavigationProvider>
    </ThemeProvider>
  );
}
