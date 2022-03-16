import { createSelector, createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";

type NoModal = {
  kind: "NONE",
};
type SqlModal = {
  kind: "RAW_SQL",
  textToExecute: string,
};
type ExportModal = {
  kind: "EXPORT",
};
type FindReplaceModal = {
  kind: "FIND_REPLACE",
};
type AllModals = NoModal | SqlModal | ExportModal | FindReplaceModal;
interface ModalState {
  visibleModal: AllModals;
}

export const modalSlice = createSlice({
  name: "migration/modal",
  initialState: {
    visibleModal: { kind: "NONE" }
  } as ModalState,
  reducers: {
    showRawSql: {
      reducer: (state, action: PayloadAction<SqlModal>) => {
        state.visibleModal = action.payload;
      },
      prepare: (textToExecute: string) => {
        return {
          payload: {
            kind: "RAW_SQL" as const,
            textToExecute,
          },
        };
      }
    },
    showExport: (state) => { state.visibleModal = { kind: "EXPORT" }; },
    showFindReplace: (state) => { state.visibleModal = { kind: "FIND_REPLACE" }; },
    hideAll: (state) => { state.visibleModal = { kind: "NONE" }; }
  },
});

export function isNoModal(modal: AllModals): modal is NoModal {
  return modal.kind === "NONE";
}

export function isSqlModal(modal: AllModals): modal is SqlModal {
  return modal.kind === "RAW_SQL";
}

export function isFindReplaceModal(modal: AllModals): modal is FindReplaceModal {
  return modal.kind === "FIND_REPLACE";
}

export function isExportModal(modal: AllModals): modal is ExportModal {
  return modal.kind === "EXPORT";
}

export const getVisibleModal = (state: RootState) => state.modals.visibleModal;
export const getRawSqlTextToExecute = createSelector(
  (state: RootState) => state.modals.visibleModal,
  (modal: AllModals) => isSqlModal(modal) ? modal.textToExecute : "",
);
export default modalSlice.reducer;
