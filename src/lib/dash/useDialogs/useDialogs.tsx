import { LoadingButton } from "@mui/lab";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  DialogContentText,
} from "@mui/material";
import invariant from "invariant";
import * as React from "react";

export interface SystemDialogBase<R> {
  onClose?: (result: R) => Promise<void>;
}

export interface AlertOptions extends SystemDialogBase<void> {
  title?: React.ReactNode;
  okText?: React.ReactNode;
}

export interface ConfirmOptions extends SystemDialogBase<boolean> {
  title?: React.ReactNode;
  color?: "error" | "info" | "success" | "warning";
  defaultValue?: string;
  okText?: React.ReactNode;
  severity?: "error" | "info" | "success" | "warning";
  cancelText?: React.ReactNode;
}

export interface PromptOptions extends SystemDialogBase<string | null> {
  title?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
}

export interface DialogProps<P, R> {
  payload: P;
  open: boolean;
  onClose: (result: R) => Promise<void>;
}

export interface OpenAlertDialog {
  (msg: React.ReactNode, options?: AlertOptions): Promise<void>;
}

export interface OpenConfirmDialog {
  (msg: React.ReactNode, options?: ConfirmOptions): Promise<boolean>;
}

export interface OpenPromptDialog {
  (msg: React.ReactNode, options?: PromptOptions): Promise<string | null>;
}

type DialogComponent<P, R> = React.ComponentType<DialogProps<P, R>>;

export interface OpenDialogOptions<P, R> {
  payload: P;
  onClose?: (result: R) => Promise<void>;
}

export interface OpenDialog {
  <P, R>(
    Component: DialogComponent<P, R>,
    options: OpenDialogOptions<P, R>,
  ): Promise<R>;
}

export interface CloseDialog {
  <R>(dialog: Promise<R>, result: R): Promise<R>;
}

export interface DialogHook {
  alert: OpenAlertDialog;
  confirm: OpenConfirmDialog;
  prompt: OpenPromptDialog;
  open: OpenDialog;
  close: CloseDialog;
}

interface DialogStackEntry<P, R> {
  key: string;
  open: boolean;
  promise: Promise<R>;
  Component: DialogComponent<P, R>;
  payload: P;
  onClose: (result: R) => Promise<void>;
  resolve: (result: R) => void;
}

const OpenDialogContext = React.createContext<OpenDialog>(async () => {
  throw new Error("No DialogProvider found");
});

const CloseDialogContext = React.createContext<CloseDialog>(async () => {
  throw new Error("No DialogProvider found");
});

export interface DialogProviderprops {
  children?: React.ReactNode;
}

export function DialogProvider({ children }: DialogProviderprops) {
  const [stack, setStack] = React.useState<DialogStackEntry<any, any>[]>([]);
  const keyPrefix = React.useId();
  const nextId = React.useRef(0);

  const requestDialog = React.useCallback<OpenDialog>(
    <P, R>(
      Component: DialogComponent<P, R>,
      { payload, onClose = async () => {} }: OpenDialogOptions<P, R>,
    ) => {
      let resolve: ((result: R) => void) | undefined;
      const promise = new Promise<R>((resolveImpl) => {
        resolve = resolveImpl;
      });
      invariant(resolve, "resolve not set");

      const key = `${keyPrefix}-${nextId.current++}`;

      const newEntry: DialogStackEntry<P, R> = {
        key,
        open: true,
        promise,
        Component,
        payload,
        onClose,
        resolve,
      };

      setStack((stack) => [...stack, newEntry]);
      return promise;
    },
    [keyPrefix],
  );

  const closeDialogUi = React.useCallback(function <R>(dialog: Promise<R>) {
    setStack((stack) =>
      stack.map((entry) =>
        entry.promise === dialog ? { ...entry, open: false } : entry,
      ),
    );
    setTimeout(() => {
      // wait for closing animation
      setStack((stack) => stack.filter((entry) => entry.promise !== dialog));
    }, 1000);
  }, []);

  const closeDialog = React.useCallback(
    async function <R>(dialog: Promise<R>, result: R) {
      const entry = stack.find((entry) => entry.promise === dialog);
      invariant(entry, "dialog not found");
      await entry.onClose(result);
      entry.resolve(result);
      closeDialogUi(dialog);
      return dialog;
    },
    [stack, closeDialogUi],
  );

  return (
    <OpenDialogContext.Provider value={requestDialog}>
      <CloseDialogContext.Provider value={closeDialog}>
        {children}
        {stack.map(({ key, open, Component, payload, promise, resolve }) => (
          <Component
            key={key}
            payload={payload}
            open={open}
            onClose={async (result) => {
              await closeDialog(promise, result);
            }}
          />
        ))}
      </CloseDialogContext.Provider>
    </OpenDialogContext.Provider>
  );
}

function useDialogLoadingButton(onClose: () => Promise<void>) {
  const [loading, setLoading] = React.useState(false);
  const handleClick = async () => {
    try {
      setLoading(true);
      await onClose();
    } finally {
      setLoading(false);
    }
  };
  return {
    onClick: handleClick,
    loading,
  };
}

export interface AlertDialogPayload extends AlertOptions {
  msg: React.ReactNode;
}

export interface AlertDialogProps
  extends DialogProps<AlertDialogPayload, void> {}

export function AlertDialog({ open, payload, onClose }: AlertDialogProps) {
  const okButtonProps = useDialogLoadingButton(() => onClose());
  return (
    <Dialog maxWidth="xs" open={open} onClose={() => onClose()}>
      <DialogTitle>{payload.title ?? "Alert"}</DialogTitle>
      <DialogContent>{payload.msg}</DialogContent>
      <DialogActions>
        <LoadingButton disabled={!open} {...okButtonProps}>
          {payload.okText ?? "Ok"}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export interface ConfirmDialogPayload extends ConfirmOptions {
  msg: React.ReactNode;
}

export interface ConfirmDialogProps
  extends DialogProps<ConfirmDialogPayload, boolean> {}

export function ConfirmDialog({ open, payload, onClose }: ConfirmDialogProps) {
  const cancelButtonProps = useDialogLoadingButton(() => onClose(false));
  const okButtonProps = useDialogLoadingButton(() => onClose(true));
  return (
    <Dialog maxWidth="xs" open={open} onClose={() => onClose(false)}>
      <DialogTitle>{payload.title ?? "Confirm"}</DialogTitle>
      <DialogContent>{payload.msg}</DialogContent>
      <DialogActions>
        <LoadingButton autoFocus disabled={!open} {...cancelButtonProps}>
          {payload.cancelText ?? "Cancel"}
        </LoadingButton>
        <LoadingButton
          color={payload.severity}
          disabled={!open}
          {...okButtonProps}
        >
          {payload.okText ?? "Ok"}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export interface PromptDialogPayload extends PromptOptions {
  msg: React.ReactNode;
}

export interface PromptDialogProps
  extends DialogProps<PromptDialogPayload, string | null> {}

export function PromptDialog({ open, payload, onClose }: PromptDialogProps) {
  const cancelButtonProps = useDialogLoadingButton(() => onClose(null));
  const [submitting, setSubmitting] = React.useState(false);
  return (
    <Dialog
      maxWidth="xs"
      open={open}
      onClose={() => onClose(null)}
      PaperProps={{
        component: "form",
        onSubmit: async (event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const formJson = Object.fromEntries(formData.entries());
          try {
            await onClose(formJson.input as string);
          } finally {
            setSubmitting(false);
          }
        },
      }}
    >
      <DialogTitle>{payload.title ?? "Confirm"}</DialogTitle>
      <DialogContent>
        <DialogContentText>{payload.msg} </DialogContentText>
        <TextField
          autoFocus
          required
          margin="dense"
          id="name"
          name="input"
          type="text"
          fullWidth
          variant="standard"
        />
      </DialogContent>
      <DialogActions>
        <LoadingButton disabled={!open} {...cancelButtonProps}>
          {payload.cancelText ?? "Cancel"}
        </LoadingButton>
        <LoadingButton disabled={!open} type="submit" loading={submitting}>
          {payload.okText ?? "Ok"}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}

export function useDialogs(): DialogHook {
  const open = React.useContext(OpenDialogContext);

  const close = React.useContext(CloseDialogContext);

  const alert = React.useCallback<OpenAlertDialog>(
    async (msg, { onClose, ...options } = {}) =>
      open(AlertDialog, { onClose, payload: { ...options, msg } }),
    [open],
  );

  const confirm = React.useCallback<OpenConfirmDialog>(
    async (msg, { onClose, ...options } = {}) =>
      open(ConfirmDialog, { onClose, payload: { ...options, msg } }),
    [open],
  );

  const prompt = React.useCallback<OpenPromptDialog>(
    async (msg, { onClose, ...options } = {}) =>
      open(PromptDialog, { onClose, payload: { ...options, msg } }),
    [open],
  );

  return React.useMemo(
    () => ({
      alert,
      confirm,
      prompt,
      open,
      close,
    }),
    [alert, close, confirm, open, prompt],
  );
}
