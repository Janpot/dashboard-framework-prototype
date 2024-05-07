"use client";

import {
  DataGridPro,
  DataGridProProps,
  GridColDef,
  GridProSlotsComponent,
  GridValueGetter,
  useGridApiRef,
} from "@mui/x-data-grid-pro";
import React from "react";
import { Box, styled } from "@mui/material";
import {
  ResolvedDataProvider,
  ResolvedField,
  Datum,
  useGetMany,
} from "../data";
import { ErrorOverlay, LoadingOverlay } from "../components";
import { useNotifications } from "../useNotifications";
import RowsLoadingOverlay from "./LoadingOverlay";

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

    return colDef;
  });

  return resolvedColumns.map((column) => {
    let valueGetter: GridValueGetter<R> | undefined = column.valueGetter;

    if (column.type === "date" || column.type === "dateTime") {
      valueGetter = wrapWithDateValueGetter(valueGetter);
    }

    return {
      ...column,
      valueGetter,
    };
  });
}

export function DataGrid<R extends Datum>({
  dataProvider,
  columns: columnsProp,
  processRowUpdate: processRowUpdateProp,
  slots: slotsProp,
  apiRef: apiRefProp,
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
        setPendingMutation(true);
        const result = await updateOne(updatedRow.id, updatedRow);
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
