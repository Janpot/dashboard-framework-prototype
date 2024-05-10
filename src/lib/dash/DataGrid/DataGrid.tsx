"use client";

import {
  DataGridPro,
  DataGridProProps,
  GridColDef,
  GridPinnedColumnFields,
  GridProSlotsComponent,
  GridRowId,
  GridRowModes,
  GridRowModesModel,
  GridToolbarColumnsButton,
  GridToolbarContainer,
  GridToolbarDensitySelector,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridValueGetter,
  useGridApiRef,
  GridRowParams,
  GridActionsCellItemProps,
  GridActionsCellItem,
  GridApiPro,
} from "@mui/x-data-grid-pro";
import React from "react";
import { Box, Button, CircularProgress, styled } from "@mui/material";
import {
  ResolvedDataProvider,
  ResolvedField,
  Datum,
  useGetMany,
} from "../data";
import { ErrorOverlay, LoadingOverlay } from "../components";
import { useNotifications } from "../useNotifications";
import RowsLoadingOverlay from "./LoadingOverlay";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import invariant from "invariant";
import { useNonNullableContext } from "../utils";

const ACTIONS_COLUMN_FIELD = "::toolpad-internal-field::actions::";

const DRAFT_ROW_ID = "::toolpad-internal-row::draft::";

const DRAFT_ROW_MARKER = Symbol("draft row");

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

type ActionRenderer<R extends Datum> = (
  params: GridRowParams<R>,
) => React.ReactElement<GridActionsCellItemProps> | null;

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
    <GridActionsCellItem
      icon={
        pending ? (
          <CircularProgress size={16} />
        ) : (
          <DeleteIcon fontSize="inherit" />
        )
      }
      label={`Delete "${id}"`}
      onClick={handleDeleteClick}
    />
  );
}

interface GridState {
  editedRowId: GridRowId | null;
  isProcessingRowUpdate: boolean;
  rowModesModel: GridRowModesModel;
}

type GridAction =
  | { kind: "START_ROW_EDIT"; rowId: GridRowId }
  | { kind: "CANCEL_ROW_EDIT" }
  | { kind: "START_ROW_UPDATE" }
  | { kind: "END_ROW_UPDATE" };

function gridEditingReducer(state: GridState, action: GridAction): GridState {
  switch (action.kind) {
    case "START_ROW_EDIT":
      return {
        ...state,
        editedRowId: action.rowId,
        rowModesModel: {
          [action.rowId]: {
            mode: GridRowModes.Edit,
          },
        },
      };
    case "CANCEL_ROW_EDIT":
      return {
        ...state,
        editedRowId: null,
        rowModesModel: state.editedRowId
          ? {
              [state.editedRowId]: {
                mode: GridRowModes.View,
                ignoreModifications: true,
              },
            }
          : {},
      };
    case "START_ROW_UPDATE":
      return {
        ...state,
        editedRowId: null,
        isProcessingRowUpdate: true,
        rowModesModel: {},
      };
    case "END_ROW_UPDATE":
      return { ...state, isProcessingRowUpdate: false };
  }
}

function getGridColDefsForDataProvider<R extends Datum>(
  dataProvider: ResolvedDataProvider<R>,
  baseColumns: readonly GridColDef<R>[],
  state: GridState,
  dispatch: React.Dispatch<GridAction>,
  apiRef: React.MutableRefObject<GridApiPro>,
): readonly GridColDef<R>[] {
  const isProcessingRowUpdate = false;

  const fieldMap = new Map<keyof R & string, ResolvedField<R, any>>(
    Object.entries(dataProvider.fields ?? {}),
  );

  const resolvedColumns = baseColumns.map(function <K extends keyof R & string>(
    baseColDef: GridColDef<R, R[K], string>,
  ): GridColDef<R, R[K], string> {
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

    if (dataProvider.updateOne && colDef.field !== "id") {
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

  const canEdit = !!dataProvider.updateOne;
  const canDelete = !!dataProvider.deleteOne;
  const canCreate = !!dataProvider.createOne;
  const hasActionsColumn: boolean = canCreate || canEdit || canDelete;

  if (hasActionsColumn) {
    resolvedColumns.push({
      field: ACTIONS_COLUMN_FIELD,
      headerName: "Actions",
      type: "actions",
      align: "center",
      resizable: false,
      pinnable: false,
      width: 100,
      getActions: (params) => {
        const actions: React.ReactElement<GridActionsCellItemProps>[] = [];

        const isEditing = state.editedRowId !== null;
        const isEditedRow = params.id === state.editedRowId;

        if (isEditedRow || isProcessingRowUpdate) {
          actions.push(
            <GridActionsCellItem
              key="save"
              icon={
                isProcessingRowUpdate ? (
                  <CircularProgress size={16} />
                ) : (
                  <SaveIcon />
                )
              }
              label="Save"
              disabled={isProcessingRowUpdate}
              onClick={() => {
                dispatch({ kind: "START_ROW_UPDATE" });
              }}
            />,
            <GridActionsCellItem
              key="cancel"
              icon={<CloseIcon />}
              label="Cancel"
              disabled={isProcessingRowUpdate}
              onClick={() => {
                dispatch({ kind: "CANCEL_ROW_EDIT" });
              }}
            />,
          );
        } else {
          if (canEdit) {
            actions.push(
              <GridActionsCellItem
                key="update"
                icon={<EditIcon />}
                label="Edit"
                disabled={isEditing}
                onClick={() => {
                  dispatch({ kind: "START_ROW_EDIT", rowId: params.id });
                }}
              />,
            );
          }
          if (canDelete) {
            actions.push(
              <DeleteAction
                key="delete"
                id={params.id}
                dataProvider={dataProvider}
              />,
            );
          }
        }
        return actions;
      },
    });
  }

  return resolvedColumns;
}

interface ToolbarCreateButtonContext {
  slotsProp?: Partial<GridProSlotsComponent>;
  onClick: () => void;
  disabled: boolean;
}

const ToolbarCreateButtonContext =
  React.createContext<ToolbarCreateButtonContext | null>(null);

function ToolbarGridCreateButton() {
  const { slotsProp, onClick, disabled } = useNonNullableContext(
    ToolbarCreateButtonContext,
  );
  const ButtonComponent = slotsProp?.baseButton ?? Button;
  return (
    <ButtonComponent
      color="primary"
      startIcon={<AddIcon />}
      onClick={onClick}
      disabled={disabled}
    >
      Add record
    </ButtonComponent>
  );
}

function ToolbarGridToolbar() {
  return (
    <GridToolbarContainer>
      <ToolbarGridCreateButton />
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      <GridToolbarExport />
    </GridToolbarContainer>
  );
}

function usePatchedRowModesModel(
  rowModesModel: GridRowModesModel,
): GridRowModesModel {
  const prevRowModesModel = React.useRef(rowModesModel);
  React.useEffect(() => {
    prevRowModesModel.current = rowModesModel;
  }, [rowModesModel]);

  return React.useMemo(() => {
    if (rowModesModel === prevRowModesModel.current) {
      return rowModesModel;
    }
    const base = Object.fromEntries(
      Object.keys(prevRowModesModel.current).map((rowId) => [
        rowId,
        { mode: GridRowModes.View },
      ]),
    );
    return { ...base, ...rowModesModel };
  }, [rowModesModel]);
}

interface DraftRow {
  [DRAFT_ROW_MARKER]?: true;
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

export function DataGrid<R extends Datum>(propsIn: DataGridProps<R>) {
  const {
    dataProvider,
    columns: columnsProp,
    processRowUpdate: processRowUpdateProp,
    slots: slotsProp,
    apiRef: apiRefProp,
    initialState: initialStateProp,
    autosizeOptions: autosizeOptionsProp,
    getRowId: getRowIdProp,
    rowModesModel: rowModesModelProp,
    pinnedRows: pinnedRowsProp,
    pinnedColumns: pinnedColumnsProp,
    ...props
  } = propsIn;

  const gridApiRefOwn = useGridApiRef();
  const apiRef = apiRefProp ?? gridApiRefOwn;
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [editingState, dispatchEditingAction] = React.useReducer(
    gridEditingReducer,
    {
      editedRowId: null,
      isProcessingRowUpdate: false,
      rowModesModel: {},
    },
  );

  const handleCreateRowRequest = React.useCallback(() => {
    dispatchEditingAction({ kind: "START_ROW_EDIT", rowId: DRAFT_ROW_ID });
  }, []);

  const [isProcessingRowUpdate, setIsProcessingRowUpdate] =
    React.useState(false);

  const notifications = useNotifications();

  const { data, loading, error, refetch } = useGetMany(dataProvider ?? null);

  const rows = React.useMemo(() => {
    const renderedRows = data?.rows ?? [];
    if (editingState.editedRowId === DRAFT_ROW_ID) {
      return [{ [DRAFT_ROW_MARKER]: true }, ...renderedRows];
    }
    return renderedRows;
  }, [data?.rows, editingState.editedRowId]);

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
        console.log("processing", updatedRow, originalRow);
        const changedValues = diff(originalRow, updatedRow);
        if (Object.keys(changedValues).length <= 0) {
          return originalRow;
        }

        setIsProcessingRowUpdate(true);
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
        setIsProcessingRowUpdate(false);
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
      toolbar: ToolbarGridToolbar,
      ...slotsProp,
    }),
    [slotsProp],
  );

  const createButtonContext = React.useMemo(() => {
    return {
      slotsProp,
      onClick: () => {
        handleCreateRowRequest();
      },
      disabled: !!editingState.editedRowId,
    };
  }, [editingState.editedRowId, handleCreateRowRequest, slotsProp]);

  const getRowId = React.useCallback(
    (row: R & DraftRow) => {
      if (row[DRAFT_ROW_MARKER]) {
        return DRAFT_ROW_ID;
      }
      if (getRowIdProp) {
        return getRowIdProp(row);
      }
      return row.id;
    },
    [getRowIdProp],
  );

  // Remove when https://github.com/mui/mui-x/issues/11423 is fixed
  const rowModesModelPatched = usePatchedRowModesModel(
    editingState.rowModesModel ?? {},
  );

  const handleRowModesModelChange = React.useCallback(
    (model: GridRowModesModel) => {
      console.log("hello", model);
    },
    [],
  );

  // Leave this to the user
  const pinnedColumns: GridPinnedColumnFields = React.useMemo(
    () => ({
      ...pinnedColumnsProp,
      right: [...(pinnedColumnsProp?.right ?? []), ACTIONS_COLUMN_FIELD],
    }),
    [pinnedColumnsProp],
  );

  const columns = React.useMemo(() => {
    if (!dataProvider) {
      return columnsProp ?? [];
    }

    const baseColumns =
      columnsProp ??
      Object.keys(dataProvider.fields).map((field) => ({ field }));

    return getGridColDefsForDataProvider(
      dataProvider,
      baseColumns,
      editingState,
      dispatchEditingAction,
      apiRef,
    );
  }, [apiRef, columnsProp, dataProvider, editingState]);

  return (
    <ToolbarCreateButtonContext.Provider value={createButtonContext}>
      <Box sx={{ height: 400, position: "relative" }}>
        {mounted ? (
          <>
            <DataGridPro
              apiRef={apiRef}
              rows={rows}
              columns={columns}
              loading={loading || isProcessingRowUpdate}
              processRowUpdate={processRowUpdate}
              slots={slots}
              rowModesModel={rowModesModelPatched}
              onRowModesModelChange={handleRowModesModelChange}
              getRowId={getRowId}
              {...props}
              // TODO: can we make this optional?
              editMode="row"
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
    </ToolbarCreateButtonContext.Provider>
  );
}
