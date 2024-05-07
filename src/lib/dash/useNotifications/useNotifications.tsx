import {
  Alert,
  Badge,
  CloseReason,
  Snackbar,
  SnackbarCloseReason,
} from "@mui/material";
import * as React from "react";

export interface EnqueueNotificationOptions {
  key?: string; // To dedupe snackbars
  severity?: "info" | "warning" | "error" | "success";
  autoHideDuration?: number;
  actionText?: React.ReactNode;
  onAction?: () => void;
}

export interface EnqueueNotification {
  (msg: React.ReactNode, options?: EnqueueNotificationOptions): void;
}

export interface CloseNotification {
  (key: string): void;
}

const EnqueueNotificationContext = React.createContext<EnqueueNotification>(
  () => {
    throw new Error("No NotificationsProvider");
  },
);

const CloseNotificationContext = React.createContext<CloseNotification>(() => {
  throw new Error("No NotificationsProvider");
});

interface NotificationQueueEntry extends EnqueueNotificationOptions {
  key: string;
  msg: React.ReactNode;
}

export interface NotificationsProviderProps {
  children?: React.ReactNode;
}

export function NotificationsProvider({
  children,
}: NotificationsProviderProps) {
  const [queue, setQueue] = React.useState<NotificationQueueEntry[]>([]);

  const enqueue = React.useCallback<EnqueueNotification>((msg, options) => {
    const key = options?.key ?? Math.random().toString(36).substring(7);
    setQueue((prev) => [...prev, { msg, ...options, key }]);
  }, []);

  const close = React.useCallback<CloseNotification>((key) => {
    setQueue((prev) => prev.filter((n) => n.key !== key));
  }, []);

  const currentNotification = queue[0] ?? null;

  const handleClose =
    (key: string) =>
    (event: unknown, reason?: CloseReason | SnackbarCloseReason) => {
      if (reason === "clickaway") {
        return;
      }
      close(key);
    };

  return (
    <EnqueueNotificationContext.Provider value={enqueue}>
      <CloseNotificationContext.Provider value={close}>
        {children}

        {currentNotification ? (
          <Snackbar
            key={currentNotification.key}
            open
            autoHideDuration={currentNotification.autoHideDuration}
            onClose={handleClose(currentNotification.key)}
          >
            <Badge
              badgeContent={queue.length > 1 ? queue.length : null}
              color="primary"
            >
              <Alert
                onClose={handleClose(currentNotification.key)}
                severity={currentNotification.severity}
                sx={{ width: "100%" }}
              >
                {currentNotification.msg}
              </Alert>
            </Badge>
          </Snackbar>
        ) : null}
      </CloseNotificationContext.Provider>
    </EnqueueNotificationContext.Provider>
  );
}

export function useNotifications() {
  const enqueue = React.useContext(EnqueueNotificationContext);
  const close = React.useContext(CloseNotificationContext);
  return React.useMemo(
    () => ({
      enqueue,
      close,
    }),
    [enqueue, close],
  );
}
