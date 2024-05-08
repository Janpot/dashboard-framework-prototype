"use client";

import {
  DataGridPro,
  DataGridProProps,
  GridColDef,
  GridProSlotsComponent,
  GridRowId,
  GridValueGetter,
  useGridApiRef,
} from "@mui/x-data-grid-pro";
import React from "react";
import { Box, CircularProgress, IconButton, styled } from "@mui/material";
import {
  ResolvedDataProvider,
  ResolvedField,
  Datum,
  useGetMany,
  useDeleteOne,
} from "../data";
import { ErrorOverlay, LoadingOverlay } from "../components";
import { useNotifications } from "../useNotifications";
import RowsLoadingOverlay from "./LoadingOverlay";
import DeleteIcon from "@mui/icons-material/Delete";
import invariant from "invariant";

const ACTIONS_COLUMN_FIELD = "::toolpad-internal-field::actions";

const PlaceholderBorder = styled("div")(({ theme }) => ({
  position: "absolute",
  inset: "0 0 0 0",
  backgroundColor: theme.palette.background.paper,
  borderColor: theme.palette.divider,
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: theme.shape.borderRadius,
}));

type ProcessRowUpdate = DataGridProProps["processRowUpdate"];
type AutoSizeOptions = DataGridProProps["autosizeOptions"];

export interface DataGridProps<R extends Datum>
  extends Omit<DataGridProProps<R>, "columns" | "rows"> {
  rows?: readonly R[];
  columns?: readonly GridColDef<R>[];
  dataProvider?: ResolvedDataProvider<R>;
}

const dateValueGetter = (value: any) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  return new Date(value);
};

function wrapWithDateValueGetter<R extends Datum>(
  valueGetter?: GridValueGetter<R>,
): GridValueGetter<R> {
  if (!valueGetter) {
    return dateValueGetter;
  }

  return (oldValue, ...args) => {
    const newValue = valueGetter(oldValue, ...args);
    return dateValueGetter(newValue);
  };
}

interface DeleteActionProps<R extends Datum> {
  id: GridRowId;
  dataProvider: ResolvedDataProvider<R>;
}

function DeleteAction<R extends Datum>({
  id,
  dataProvider,
}: DeleteActionProps<R>) {
  const [pending, setPending] = React.useState(false);
  const { refetch } = useGetMany(dataProvider);

  const notifications = useNotifications();

  const handleDeleteClick = React.useCallback(async () => {
    try {
      setPending(true);
      invariant(dataProvider.deleteOne, "deleteOne not implemented");
      await dataProvider.deleteOne(id);
      notifications.enqueue("Row deleted", { severity: "success" });
    } catch (error) {
      notifications.enqueue("Failed to delete row", { severity: "error" });
    } finally {
      setPending(false);
      await refetch();
    }
  }, [dataProvider, id, notifications, refetch]);

  return (
    <IconButton
      onClick={handleDeleteClick}
      size="small"
      aria-label={`Delete row with id "${id}"`}
    >
      {pending ? (
        <CircularProgress size={16} />
      ) : (
        <DeleteIcon fontSize="inherit" />
      )}
    </IconButton>
  );
}

function getGridColDefsForDataProvider<R extends Datum>(
  dataProvider: ResolvedDataProvider<R> | null,
  columnsProp?: readonly GridColDef<R>[],
): readonly GridColDef<R>[] {
  if (!dataProvider) {
    return columnsProp ?? [];
  }

  const fieldMap = new Map<keyof R & string, ResolvedField<R, any>>(
    Object.entries(dataProvider.fields ?? {}),
  );

  const startColumns: readonly GridColDef<R>[] =
    columnsProp ||
    Array.from(fieldMap.keys(), (field: keyof R & string) => ({ field }));

  const resolvedColumns = startColumns.map(function <
    K extends keyof R & string,
  >(baseColDef: GridColDef<R, R[K], string>): GridColDef<R, R[K], string> {
    const dataProviderField: ResolvedField<R, K> | undefined = fieldMap.get(
      baseColDef.field,
    );
    const colDef: GridColDef<R, R[K], string> = {
      type: dataProviderField?.type,
      headerName: dataProviderField?.label,
      ...baseColDef,
    };

    const valueFormatter = dataProviderField?.valueFormatter;
    if (valueFormatter && !colDef.valueFormatter) {
      colDef.valueFormatter = (value) =>
        valueFormatter(value, colDef.field as K);
    }

    if (dataProvider.updateOne) {
      colDef.editable = true;
    }

    let valueGetter: GridValueGetter<R> | undefined = colDef.valueGetter;

    if (colDef.type === "date" || colDef.type === "dateTime") {
      valueGetter = wrapWithDateValueGetter(valueGetter);
    }

    return {
      ...colDef,
      valueGetter,
    };
  });

  if (dataProvider.deleteOne) {
    resolvedColumns.push({
      field: ACTIONS_COLUMN_FIELD,
      type: "actions",
      align: "center",
      resizable: false,
      pinnable: false,
      width: 50,
      getActions: ({ id }) => {
        return [
          <DeleteAction key="delete" id={id} dataProvider={dataProvider} />,
        ];
      },
    });
  }

  return resolvedColumns;
}

function diff<R extends Record<PropertyKey, unknown>>(
  original: R,
  changed: R,
): Partial<R> {
  const keys = new Set([...Object.keys(original), ...Object.keys(changed)]);
  const diff: Partial<R> = {};
  for (const key of keys) {
    if (original[key] !== changed[key]) {
      (diff as any)[key] = changed[key];
    }
  }
  return diff;
}

export function DataGrid<R extends Datum>({
  dataProvider,
  columns: columnsProp,
  processRowUpdate: processRowUpdateProp,
  slots: slotsProp,
  apiRef: apiRefProp,
  initialState: initialStateProp,
  autosizeOptions: autosizeOptionsProp,
  ...props
}: DataGridProps<R>) {
  const gridApiRefOwn = useGridApiRef();
  const apiRef = apiRefProp ?? gridApiRefOwn;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [pendingMutation, setPendingMutation] = React.useState(false);

  const notifications = useNotifications();

  const { data, loading, error, refetch } = useGetMany(dataProvider ?? null);

  const columns = React.useMemo(
    () => getGridColDefsForDataProvider(dataProvider ?? null, columnsProp),
    [columnsProp, dataProvider],
  );

  const rows = React.useMemo(() => data?.rows ?? [], [data]);

  const processRowUpdate = React.useMemo<ProcessRowUpdate>(() => {
    if (processRowUpdateProp) {
      return processRowUpdateProp;
    }
    const updateOne = dataProvider?.updateOne;
    if (!updateOne) {
      return undefined;
    }
    return async (updatedRow: R, originalRow: R): Promise<R> => {
      try {
        const changedValues = diff(originalRow, updatedRow);
        if (Object.keys(changedValues).length <= 0) {
          return originalRow;
        }

        setPendingMutation(true);
        const result = await updateOne(updatedRow.id, changedValues);
        const key = notifications.enqueue("Row updated", {
          severity: "success",
          actionText: "Show",
          onAction: () => {
            apiRef.current.setFilterModel({
              items: [
                { field: "id", operator: "equals", value: String(result.id) },
              ],
            });
            notifications.close(key);
          },
        });
        return result;
      } catch (error) {
        notifications.enqueue("Failed to update row", { severity: "error" });
        return originalRow;
      } finally {
        setPendingMutation(false);
        refetch();
      }
    };
  }, [
    apiRef,
    dataProvider?.updateOne,
    notifications,
    processRowUpdateProp,
    refetch,
  ]);

  const slots = React.useMemo<Partial<GridProSlotsComponent>>(
    () => ({
      loadingOverlay: RowsLoadingOverlay,
      ...slotsProp,
    }),
    [slotsProp],
  );

  const initialState = {
    ...initialStateProp,
    pinnedColumns: {
      ...initialStateProp?.pinnedColumns,
      right: [
        ...(initialStateProp?.pinnedColumns?.right ?? []),
        ACTIONS_COLUMN_FIELD,
      ],
    },
  };

  return (
    <Box sx={{ height: 400, position: "relative" }}>
      {mounted ? (
        <>
          <DataGridPro
            apiRef={apiRef}
            rows={rows}
            columns={columns}
            loading={loading || pendingMutation}
            processRowUpdate={processRowUpdate}
            slots={slots}
            initialState={initialState}
            {...props}
          />
          {error ? (
            <PlaceholderBorder>
              <ErrorOverlay error={error} />
            </PlaceholderBorder>
          ) : null}
        </>
      ) : (
        <PlaceholderBorder>
          <LoadingOverlay />
        </PlaceholderBorder>
      )}
    </Box>
  );
}
