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

export interface AlertOptions {
  title?: React.ReactNode;
  okText?: React.ReactNode;
}

export interface ConfirmOptions {
  title?: React.ReactNode;
  color?: "error" | "info" | "success" | "warning";
  defaultValue?: string;
  okText?: React.ReactNode;
  severity?: "error" | "info" | "success" | "warning";
  cancelText?: React.ReactNode;
}

export interface PromptOptions {
  title?: React.ReactNode;
  okText?: React.ReactNode;
  cancelText?: React.ReactNode;
}

export interface DialogProps<P, R> {
  payload: P;
  open: boolean;
  onClose: (result: R) => void;
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

export interface OpenDialog {
  <P, R>(Component: DialogComponent<P, R>, payload: P): Promise<R>;
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

  const requestDialog = React.useCallback(
    <P, R>(Component: DialogComponent<P, R>, payload: P) => {
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
            onClose={(result) => {
              closeDialog(promise, result);
            }}
          />
        ))}
      </CloseDialogContext.Provider>
    </OpenDialogContext.Provider>
  );
}

export interface AlertDialogPayload extends AlertOptions {
  msg: React.ReactNode;
}

export interface AlertDialogProps
  extends DialogProps<AlertDialogPayload, void> {}

export function AlertDialog({ open, payload, onClose }: AlertDialogProps) {
  return (
    <Dialog maxWidth="xs" open={open}>
      <DialogTitle>{payload.title ?? "Alert"}</DialogTitle>
      <DialogContent>{payload.msg}</DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>{payload.okText ?? "Ok"}</Button>
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
  return (
    <Dialog maxWidth="xs" open={open}>
      <DialogTitle>{payload.title ?? "Confirm"}</DialogTitle>
      <DialogContent>{payload.msg}</DialogContent>
      <DialogActions>
        <Button autoFocus onClick={() => onClose(false)}>
          {payload.cancelText ?? "Cancel"}
        </Button>
        <Button color={payload.severity} onClick={() => onClose(true)}>
          {payload.okText ?? "Ok"}
        </Button>
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
  return (
    <Dialog
      maxWidth="xs"
      open={open}
      PaperProps={{
        component: "form",
        onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const formJson = Object.fromEntries(formData.entries());
          onClose(formJson.input as string);
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
        <Button autoFocus onClick={() => onClose(null)}>
          {payload.cancelText ?? "Cancel"}
        </Button>
        <Button type="submit">{payload.okText ?? "Ok"}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function useDialog(): DialogHook {
  const open = React.useContext(OpenDialogContext);

  const close = React.useContext(CloseDialogContext);

  const alert = React.useCallback<OpenAlertDialog>(
    async (msg, options) => open(AlertDialog, { ...options, msg }),
    [open],
  );

  const confirm = React.useCallback<OpenConfirmDialog>(
    async (msg, options) => open(ConfirmDialog, { ...options, msg }),
    [open],
  );

  const prompt = React.useCallback<OpenPromptDialog>(
    async (msg, options) => open(PromptDialog, { ...options, msg }),
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
