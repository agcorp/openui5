/*!
 * ${copyright}
 */

// Provides helper sap.ui.table.TableUtils.
sap.ui.define(['jquery.sap.global', 'sap/ui/core/Control', 'sap/ui/core/ResizeHandler', './TableGrouping', './TableColumnUtils', 'sap/ui/Device', './library'],
	function(jQuery, Control, ResizeHandler, TableGrouping, TableColumnUtils, Device, library) {
	"use strict";

	// shortcuts
	var SelectionBehavior = library.SelectionBehavior,
		SelectionMode = library.SelectionMode;

	/**
	 * Static collection of utility functions related to the sap.ui.table.Table, ...
	 *
	 * @author SAP SE
	 * @version ${version}
	 * @namespace
	 * @name sap.ui.table.TableUtils
	 * @private
	 */
	var TableUtils = {

		Grouping: TableGrouping, //Make grouping utils available here
		ColumnUtils: TableColumnUtils, //Make column utils available here

		/*
 		 * Known basic cell types in the table
		 */
		CELLTYPES : {
			DATACELL : "DATACELL", // standard data cell (standard, group or sum)
			COLUMNHEADER : "COLUMNHEADER", // column header
			ROWHEADER : "ROWHEADER", // row header (standard, group or sum)
			COLUMNROWHEADER : "COLUMNROWHEADER" // select all row selector (top left cell)
		},

		CONTENT_DENSITY_ROW_HEIGHTS : {
			sapUiSizeCondensed : 24,
			sapUiSizeCompact : 32,
			sapUiSizeCozy : 48,
			undefined : 32
		},

		/**
		 * Returns whether the table has a row header or not
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {boolean}
		 * @private
		 */
		hasRowHeader : function(oTable) {
			return (oTable.getSelectionMode() !== SelectionMode.None
					&& oTable.getSelectionBehavior() !== SelectionBehavior.RowOnly)
					|| TableGrouping.isGroupMode(oTable);
		},

		/**
		 * Returns whether selection is allowed on the cells of a row (not row selector).
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {boolean}
		 * @private
		 */
		isRowSelectionAllowed : function(oTable) {
			return oTable.getSelectionMode() !== SelectionMode.None &&
				(oTable.getSelectionBehavior() === SelectionBehavior.Row || oTable.getSelectionBehavior() === SelectionBehavior.RowOnly);
		},

		/**
		 * Returns whether selection is allowed via the row selector.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {boolean}
		 * @private
		 */
		isRowSelectorSelectionAllowed : function(oTable) {
			// Incl. that RowOnly works like Row
			return oTable.getSelectionMode() !== SelectionMode.None && TableUtils.hasRowHeader(oTable);
		},

		/**
		 * Finds out if all rows are selected in a table.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @returns {boolean} Returns <code>true</code> if all rows in the table are selected.
		 */
		areAllRowsSelected: function(oTable) {
			if (oTable == null) {
				return false;
			}

			var iSelectableRowCount = oTable._getSelectableRowCount();
			return iSelectableRowCount > 0 && iSelectableRowCount === oTable.getSelectedIndices().length;
		},

		/**
		 * Returns whether the no data text is currently shown or not
		 * If true, also CSS class sapUiTableEmpty is set on the table root element.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {boolean}
		 * @private
		 */
		isNoDataVisible : function(oTable) {
			if (!oTable.getShowNoData()) {
				return false;
			}

			var oBinding = oTable.getBinding("rows"),
				iBindingLength = oTable._getRowCount(),
				bHasData = oBinding ? !!iBindingLength : false;

			if (oBinding && oBinding.providesGrandTotal) { // Analytical Binding
				var bHasTotal = oBinding.providesGrandTotal() && oBinding.hasTotaledMeasures();
				bHasData = (bHasTotal && iBindingLength < 2) || (!bHasTotal && iBindingLength === 0) ? false : true;
			}

			return !bHasData;
		},

		/**
		 * Checks whether the given object is of the given type (given in AMD module syntax)
		 * without the need of loading the types module.
		 * @param {sap.ui.base.ManagedObject} oObject The object to check
		 * @param {string} sType The type given in AMD module syntax
		 * @return {boolean}
		 * @private
		 */
		isInstanceOf : function(oObject, sType) {
			if (!oObject || !sType) {
				return false;
			}
			var oType = sap.ui.require(sType);
			return !!(oType && (oObject instanceof oType));
		},

		/**
		 * Toggles the expand / collapse state of the group which contains the given Dom element.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {Object} oRef DOM reference of an element within the table group header
		 * @param {boolean} [bExpand] If defined instead of toggling the desired state is set.
		 * @return {boolean} <code>true</code> when the operation was performed, <code>false</code> otherwise.
		 * @private
		 */
		toggleGroupHeader : function(oTable, oRef, bExpand) {
			var $Ref = jQuery(oRef),
				$GroupRef;

			if ($Ref.hasClass("sapUiTableTreeIcon")) {
				$GroupRef = $Ref.closest("tr");
			} else {
				$GroupRef = $Ref.closest(".sapUiTableGroupHeader");
			}

			var oBinding = oTable.getBinding("rows");
			if ($GroupRef.length > 0 && oBinding) {
				var iRowIndex = oTable.getFirstVisibleRow() + parseInt($GroupRef.data("sap-ui-rowindex"), 10);
				var bIsExpanded = TableGrouping.toggleGroupHeader(oTable, iRowIndex, bExpand);
				var bChanged = bIsExpanded === true || bIsExpanded === false;
				if (bChanged && oTable._onGroupHeaderChanged) {
					oTable._onGroupHeaderChanged(iRowIndex, bIsExpanded);
				}
				return bChanged;
			}
			return false;
		},

		/**
		 * Toggles the selection state of the row which contains the given cell DOM element.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {jQuery|HTMLElement|int} oRowIndicator The data cell in the row, or the data row index of the row,
		 * 												 where the selection state should be toggled.
		 * @param {boolean} [bSelect] If defined, then instead of toggling the desired state is set.
		 * @returns {boolean} Returns <code>true</code> if the selection state of the row has been changed.
		 * @private
		 */
		toggleRowSelection: function(oTable, oRowIndicator, bSelect) {
			if (oTable == null ||
				oTable.getBinding("rows") == null ||
				oTable.getSelectionMode() === SelectionMode.None ||
				oRowIndicator == null) {

				return false;
			}

			function setSelectionState(iAbsoluteRowIndex) {
				oTable._iSourceRowIndex = iAbsoluteRowIndex; // To indicate that the selection was changed by user interaction.

				if (oTable.isIndexSelected(iAbsoluteRowIndex)) {
					if (bSelect != null && bSelect) {
						return false;
					}
					oTable.removeSelectionInterval(iAbsoluteRowIndex, iAbsoluteRowIndex);
				} else {
					if (bSelect != null && !bSelect) {
						return false;
					}
					oTable.addSelectionInterval(iAbsoluteRowIndex, iAbsoluteRowIndex);
				}

				delete oTable._iSourceRowIndex;
				return true;
			}

			// Variable oRowIndicator is a row index value.
			if (typeof oRowIndicator === "number") {
				if (oRowIndicator < 0 || oRowIndicator >= oTable._getRowCount()) {
					return false;
				}
				return setSelectionState(oRowIndicator);

			// Variable oRowIndicator is a jQuery object or DOM element.
			} else {
				var $Cell = jQuery(oRowIndicator);
				var oCellInfo = this.getCellInfo($Cell[0]);

				if (oCellInfo !== null
					&& !TableUtils.isInGroupingRow($Cell[0])
					&& ((oCellInfo.type === this.CELLTYPES.DATACELL && this.isRowSelectionAllowed(oTable))
					|| (oCellInfo.type === this.CELLTYPES.ROWHEADER && this.isRowSelectorSelectionAllowed(oTable)))) {

					var iAbsoluteRowIndex;
					if (oCellInfo.type === this.CELLTYPES.DATACELL) {
						iAbsoluteRowIndex = oTable.getRows()[parseInt($Cell.closest("tr", oTable.getDomRef()).attr("data-sap-ui-rowindex"), 10)].getIndex();
					} else { // CELLTYPES.ROWHEADER
						iAbsoluteRowIndex = oTable.getRows()[parseInt($Cell.attr("data-sap-ui-rowindex"), 10)].getIndex();
					}

					return setSelectionState(iAbsoluteRowIndex);
				}

				return false;
			}
		},

		/**
		 * Returns the text to be displayed as no data message.
		 * If a custom noData control is set null is returned.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {String|string|null}
		 * @private
		 */
		getNoDataText : function(oTable) {
			var oNoData = oTable.getNoData();
			if (oNoData instanceof Control) {
				return null;
			} else if (typeof oNoData === "string" || oTable.getNoData() instanceof String) {
				return oNoData;
			} else {
				return oTable._oResBundle.getText("TBL_NO_DATA");
			}
		},

		/**
		 * Returns the number of currently visible columns
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {int}
		 * @private
		 */
		getVisibleColumnCount : function(oTable) {
			return oTable._getVisibleColumns().length;
		},

		/**
		 * Returns the number of header rows
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {int}
		 * @private
		 */
		getHeaderRowCount : function(oTable) {
			if (!oTable.getColumnHeaderVisible()) {
				return 0;
			}

			var iHeaderRows = 1;
			var aColumns = oTable.getColumns();
			for (var i = 0; i < aColumns.length; i++) {
				if (aColumns[i].shouldRender()) {
					// only visible columns need to be considered. We don't invoke getVisibleColumns due to
					// performance considerations. With several dozens of columns, it's quite costy to loop them twice.
					iHeaderRows = Math.max(iHeaderRows,  aColumns[i].getMultiLabels().length);
				}
			}

			return iHeaderRows;
		},

		/**
		 * Returns the height of the defined row, identified by its row index.
		 * @param {Object} oTable current table object
		 * @param {int} iRowIndex the index of the row which height is needed
		 * @private
		 * @return {int}
		 */
		getRowHeightByIndex : function(oTable, iRowIndex) {
			var iRowHeight = 0;

			if (oTable) {
				var aRows = oTable.getRows();
				if (aRows && aRows.length && iRowIndex > -1 && iRowIndex < aRows.length) {
					var oDomRefs = aRows[iRowIndex].getDomRefs();
					if (oDomRefs) {
						if (oDomRefs.rowScrollPart && oDomRefs.rowFixedPart) {
							iRowHeight = Math.max(oDomRefs.rowScrollPart.clientHeight, oDomRefs.rowFixedPart.clientHeight);
						} else if (!oDomRefs.rowFixedPart) {
							iRowHeight = oDomRefs.rowScrollPart.clientHeight;
						}
					}
				}
			}

			return iRowHeight;
		},

		/**
		 * Checks whether all conditions for pixel-based scrolling (Variable Row Height) are fulfilled.
		 * @param {Object} oTable current table object
		 * @returns {Boolean} true/false if fulfilled
		 * @private
		 */
		isVariableRowHeightEnabled : function(oTable) {
			return oTable._bVariableRowHeightEnabled && oTable.getFixedRowCount() <= 0 && oTable.getFixedBottomRowCount() <= 0;
		},

		/**
		 * Returns the logical number of rows
		 * Optionally empty visible rows are added (in case that the number of data
		 * rows is smaller than the number of visible rows)
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {boolean} bIncludeEmptyRows
		 * @return {int}
		 * @private
		 */
		getTotalRowCount : function(oTable, bIncludeEmptyRows) {
			var iRowCount = oTable._getRowCount();
			if (bIncludeEmptyRows) {
				iRowCount = Math.max(iRowCount, oTable.getVisibleRowCount());
			}
			return iRowCount;
		},

		/**
		 * Returns the number of visible rows that are not empty.
		 * If the number of visible rows is smaller than the number of data rows,
		 * the number of visible rows is returned, otherwise the number of data rows.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @returns {int}
		 * @private
		 */
		getNonEmptyVisibleRowCount : function(oTable) {
			return Math.min(oTable.getVisibleRowCount(), oTable._getRowCount());
		},

		/**
		 * Returns a combined info about the currently focused item (based on the item navigation)
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {Object|null}
		 * @type {Object}
		 * @property {int} cell Index of focused cell in ItemNavigation
		 * @property {int} columnCount Number of columns in ItemNavigation
		 * @property {int} cellInRow Index of the cell in row
		 * @property {int} row Index of row in ItemNavigation
		 * @property {int} cellCount Number of cells in ItemNavigation
		 * @property {Object|undefined} domRef Focused DOM reference of undefined
		 * @private
		 */
		getFocusedItemInfo : function(oTable) {
			var oIN = oTable._getItemNavigation();
			if (!oIN) {
				return null;
			}
			return {
				cell: oIN.getFocusedIndex(),
				columnCount: oIN.iColumns,
				cellInRow: oIN.getFocusedIndex() % oIN.iColumns,
				row: Math.floor(oIN.getFocusedIndex() / oIN.iColumns),
				cellCount: oIN.getItemDomRefs().length,
				domRef: oIN.getFocusedDomRef()
			};
		},

		/**
		 * Returns the index of the column (in the array of visible columns (see Table._getVisibleColumns())) of the current focused cell
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {int}
		 * @private
		 */
		getColumnIndexOfFocusedCell : function(oTable) {
			var oInfo = TableUtils.getFocusedItemInfo(oTable);
			return oInfo.cellInRow - (TableUtils.hasRowHeader(oTable) ? 1 : 0);
		},

		/**
		 * Returns the index of the row (in the rows aggregation) of the current focused cell
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {int}
		 * @private
		 *
		 */
		getRowIndexOfFocusedCell : function(oTable) {
			var oInfo = TableUtils.getFocusedItemInfo(oTable);
			return oInfo.row - TableUtils.getHeaderRowCount(oTable);
		},

		/**
		 * Returns whether the given cell is located in a group header.
		 * @param {Object} oCellRef DOM reference of table cell
		 * @return {boolean}
		 * @private
		 */
		isInGroupingRow : function(oCellRef) {
			var oInfo = TableUtils.getCellInfo(oCellRef);
			if (oInfo && oInfo.type === TableUtils.CELLTYPES.DATACELL) {
				return oInfo.cell.parent().hasClass("sapUiTableGroupHeader");
			} else if (oInfo && oInfo.type === TableUtils.CELLTYPES.ROWHEADER) {
				return oInfo.cell.hasClass("sapUiTableGroupHeader");
			}
			return false;
		},

		/**
		 * Returns whether the given cell is located in a analytical summary row.
		 * @param {Object} oCellRef DOM reference of table cell
		 * @return {boolean}
		 * @private
		 */
		isInSumRow : function(oCellRef) {
			var oInfo = TableUtils.getCellInfo(oCellRef);
			if (oInfo && oInfo.type === TableUtils.CELLTYPES.DATACELL) {
				return oInfo.cell.parent().hasClass("sapUiAnalyticalTableSum");
			} else if (oInfo && oInfo.type === TableUtils.CELLTYPES.ROWHEADER) {
				return oInfo.cell.hasClass("sapUiAnalyticalTableSum");
			}
			return false;
		},

		/**
		 * Returns whether column with the given index (in the array of visible columns (see Table._getVisibleColumns()))
		 * is a fixed column.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {int} iColIdx Index of column in the tables column aggregation
		 * @return {boolean}
		 * @private
		 */
		isFixedColumn : function(oTable, iColIdx) {
			return iColIdx < oTable.getFixedColumnCount();
		},

		/**
		 * Returns whether the table has fixed columns.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @return {boolean}
		 * @private
		 */
		hasFixedColumns : function(oTable) {
			return oTable.getFixedColumnCount() > 0;
		},

		/**
		 * Focus the item with the given index in the item navigation
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {int} iIndex Index of item in ItemNavigation which shall get the focus
		 * @param {Object} oEvent
		 * @private
		 */
		focusItem : function(oTable, iIndex, oEvent) {
			var oIN = oTable._getItemNavigation();
			if (oIN) {
				oIN.focusItem(iIndex, oEvent);
			}
		},

		/**
		 * Returns the cell type and the jQuery wrapper object of the given cell dom ref or
		 * null if the given dom element is not a table cell.
		 * {type: <TYPE>, cell: <$CELL>}
		 * @param {Object} oCellRef DOM reference of table cell
		 * @return {Object}
		 * @type {Object}
		 * @property {sap.ui.table.CELLTYPES} type
		 * @property {Object} cell jQuery object of the cell
		 * @see TableUtils.CELLTYPES
		 * @private
		 */
		getCellInfo : function(oCellRef) {
			if (!oCellRef) {
				return null;
			}
			var $Cell = jQuery(oCellRef);
			if ($Cell.hasClass("sapUiTableTd")) {
				return {type: TableUtils.CELLTYPES.DATACELL, cell: $Cell};
			} else if ($Cell.hasClass("sapUiTableCol")) {
				return {type: TableUtils.CELLTYPES.COLUMNHEADER, cell: $Cell};
			} else if ($Cell.hasClass("sapUiTableRowHdr")) {
				return {type: TableUtils.CELLTYPES.ROWHEADER, cell: $Cell};
			} else if ($Cell.hasClass("sapUiTableColRowHdr")) {
				return {type: TableUtils.CELLTYPES.COLUMNROWHEADER, cell: $Cell};
			}
			return null;
		},

		/**
		 * Returns the index and span information of a column header cell.
		 * @param {jQuery|HtmlElement} oCell The column header cell.
		 * @returns {{index: int, span: int}|null} Returns <code>null</code> if <code>oCell</code> is not a table column header cell.
		 * @private
		 */
		getColumnHeaderCellInfo: function(oCell) {
			if (oCell == null) {
				return null;
			}

			var $Cell = jQuery(oCell);
			var oCellInfo = this.getCellInfo($Cell);

			if (oCellInfo !== null && oCellInfo.type === TableUtils.CELLTYPES.COLUMNHEADER) {
				return {
					index: parseInt($Cell.data("sap-ui-colindex"), 10),
					span: parseInt($Cell.attr("colspan") || 1, 10)
				};
			} else {
				return null;
			}
		},

		/**
		 * Returns the Row, Column and Cell instances for the given row index (in the rows aggregation)
		 * and column index (in the array of visible columns (see Table._getVisibleColumns()).
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {int} iRowIdx Index of row in the tables rows aggregation
		 * @param {int} iColIdx Index of column in the list of visible columns
		 * @return {Object}
		 * @type {Object}
		 * @property {sap.ui.table.Row} row Row of the table
		 * @property {sap.ui.table.Column} column Column of the table
		 * @property {sap.ui.core.Control} cell Cell control of row/column
		 * @private
		 */
		getRowColCell : function(oTable, iRowIdx, iColIdx) {
			var oRow = oTable.getRows()[iRowIdx];
			var oColumn = oTable._getVisibleColumns()[iColIdx];
			var oCell = oRow && oRow.getCells()[iColIdx];

			//TBD: Clarify why this is needed!
			if (oCell && oCell.data("sap-ui-colid") != oColumn.getId()) {
				var aCells = oRow.getCells();
				for (var i = 0; i < aCells.length; i++) {
					if (aCells[i].data("sap-ui-colid") === oColumn.getId()) {
						oCell = aCells[i];
						break;
					}
				}
			}

			return {row: oRow, column: oColumn, cell: oCell};
		},

		/**
		 * Returns all interactive elements in a data cell.
		 * @param {jQuery|HTMLElement} oCell The data cell from which to get the interactive elements.
		 * @returns {jQuery|null} Returns null if the passed cell is not a cell or does not contain any interactive elements.
		 * @private
		 */
		getInteractiveElements : function(oCell) {
			if (oCell == null) {
				return null;
			}

			var $Cell = jQuery(oCell);
			var oCellInfo = this.getCellInfo($Cell);

			if (oCellInfo !== null && oCellInfo.type === this.CELLTYPES.DATACELL) {
				var $InteractiveElements = $Cell.find(":sapFocusable");
				if ($InteractiveElements.length > 0) {
					return $InteractiveElements;
				}
			}

			return null;
		},

		/**
		 * Returns the data cell which is the parent of the specified element.
		 * @param {sap.ui.table.Table} oTable Instance of the table used as the context within which to search for the parent.
		 * @param {jQuery|HTMLElement} oElement An element inside a table data cell.
		 * @returns {jQuery|null} Returns null if the passed element is not inside a data cell.
		 * @private
		 */
		getParentDataCell: function(oTable, oElement) {
			if (oTable == null || oElement == null) {
				return null;
			}

			var $Element = jQuery(oElement);
			var $ParentCell = $Element.parent().closest(".sapUiTableTd", oTable.getDomRef());

			if ($ParentCell.length > 0) {
				return $ParentCell;
			}

			return null;
		},

		/**
		 * Returns the table cell which is either the parent of the specified element, or returns the specified element itself if it is a table cell.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table used as the context within which to search for the parent.
		 * @param {jQuery|HTMLElement} oElement An element inside a table cell. Can be a jQuery object or a DOM Element.
		 * @returns {jQuery|null} Returns null if the passed element is not inside a table cell or a table cell itself.
		 * @private
		 */
		getCell: function(oTable, oElement) {
			if (oTable == null || oElement == null) {
				return null;
			}

			var $Element = jQuery(oElement);
			var $Cell;
			var oTableElement = oTable.getDomRef();

			$Cell = $Element.closest(".sapUiTableTd", oTableElement);
			if ($Cell.length > 0) {
				return $Cell;
			}

			$Cell = $Element.closest(".sapUiTableCol", oTableElement);
			if ($Cell.length > 0) {
				return $Cell;
			}

			$Cell = $Element.closest(".sapUiTableRowHdr", oTableElement);
			if ($Cell.length > 0) {
				return $Cell;
			}

			$Cell = $Element.closest(".sapUiTableColRowHdr", oTableElement);
			if ($Cell.length > 0) {
				return $Cell;
			}

			return null;
		},

		/**
		 * Registers a ResizeHandler for a DOM reference identified by its ID suffix. The ResizeHandler ID is tracked
		 * in _mResizeHandlerIds of the table instance. The sIdSuffix is used as key.
		 * Existing ResizeHandlers will be de-registered before the new one is registered.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {string} sIdSuffix ID suffix to identify the DOM element for which to register the ResizeHandler
		 * @param {Function} fnHandler Function to handle the resize event
		 * @param {boolean}[bRegisterParent] Flag to register the ResizeHandler for the parent DOM element of the one identified by sIdSuffix
		 *
		 * @return {int|undefined} ResizeHandler ID or undefined if the DOM element could not be found
		 * @private
		 */
		registerResizeHandler : function(oTable, sIdSuffix, fnHandler, bRegisterParent) {
			var oDomRef;
			if (typeof sIdSuffix == "string") {
				oDomRef = oTable.getDomRef(sIdSuffix);
			} else {
				jQuery.sap.log.error("sIdSuffix must be a string", oTable);
				return;
			}

			if (typeof fnHandler !== "function") {
				jQuery.sap.log.error("fnHandler must be a function", oTable);
				return;
			}

			// make sure that each DOM element of the table can only have one resize handler in order to avoid memory leaks
			this.deregisterResizeHandler(oTable, sIdSuffix);

			if (!oTable._mResizeHandlerIds) {
				oTable._mResizeHandlerIds = {};
			}

			if (bRegisterParent && oDomRef) {
				oDomRef = oDomRef.parentNode;
			}

			if (oDomRef) {
				oTable._mResizeHandlerIds[sIdSuffix] = ResizeHandler.register(oDomRef, fnHandler);
			}

			return oTable._mResizeHandlerIds[sIdSuffix];
		},

		/**
		 * De-register ResizeHandler identified by sIdSuffix. If sIdSuffix is undefined, all know ResizeHandlers will be de-registered
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {string|Array.<string>} [vIdSuffix] ID suffix to identify the ResizeHandler to de-register. If undefined, all will be de-registered
		 * @private
		 */
		deregisterResizeHandler : function(oTable, vIdSuffix) {
			var aIdSuffix;
			if (!oTable._mResizeHandlerIds) {
				// no resize handler registered so far
				return;
			}

			if (typeof vIdSuffix == "string") {
				aIdSuffix = [vIdSuffix];
			} else if (vIdSuffix === undefined) {
				aIdSuffix = [];
				// de-register all resize handlers if no specific is named
				for (var sKey in oTable._mResizeHandlerIds) {
					if (typeof sKey == "string" && oTable._mResizeHandlerIds.hasOwnProperty(sKey)) {
						aIdSuffix.push(sKey);
					}
				}
			} else if (jQuery.isArray(vIdSuffix)) {
				aIdSuffix = vIdSuffix;
			}

			for (var i = 0; i < aIdSuffix.length; i++) {
				var sIdSuffix = aIdSuffix[i];
				if (oTable._mResizeHandlerIds[sIdSuffix]) {
					ResizeHandler.deregister(oTable._mResizeHandlerIds[sIdSuffix]);
					oTable._mResizeHandlerIds[sIdSuffix] = undefined;
				}
			}
		},

		/**
		 * Scrolls the data in the table forward or backward by manipulating the property <code>firstVisibleRow</code>.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {boolean} bDown Whether to scroll down or up
		 * @param {boolean} bPage Whether scrolling should be page wise or a single step (only possibe with navigation mode <code>Scrollbar</code>)
		 * @private
		 */
		scroll : function(oTable, bDown, bPage) {
			var bScrolled = false;
			var iRowCount = oTable._getRowCount();
			var iVisibleRowCount = oTable.getVisibleRowCount();
			var iScrollableRowCount = iVisibleRowCount - oTable.getFixedRowCount() - oTable.getFixedBottomRowCount();
			var iFirstVisibleScrollableRow = oTable._getSanitizedFirstVisibleRow();
			var iSize = bPage ? iScrollableRowCount : 1;

			if (bDown) {
				if (iFirstVisibleScrollableRow + iVisibleRowCount < iRowCount) {
					oTable.setFirstVisibleRow(Math.min(iFirstVisibleScrollableRow + iSize, iRowCount - iVisibleRowCount));
					bScrolled = true;
				}
			} else {
				if (iFirstVisibleScrollableRow > 0) {
					oTable.setFirstVisibleRow(Math.max(iFirstVisibleScrollableRow - iSize, 0));
					bScrolled = true;
				}
			}

			return bScrolled;
		},

		/**
		 * Scrolls the data in the table to the end or to the beginning by manipulating the property <code>firstVisibleRow</code>.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {boolean} bDown Whether to scroll down or up
		 * @returns {boolean} True if scrolling was actually performed
		 * @private
		 */
		scrollMax : function(oTable, bDown) {
			var bScrolled = false;
			var iFirstVisibleScrollableRow = oTable._getSanitizedFirstVisibleRow();

			if (bDown) {
				var iFirstVisibleRow = oTable._getRowCount() - this.getNonEmptyVisibleRowCount(oTable);
				if (iFirstVisibleScrollableRow < iFirstVisibleRow) {
					oTable.setFirstVisibleRow(iFirstVisibleRow);
					bScrolled = true;
				}
			} else {
				if (iFirstVisibleScrollableRow > 0) {
					oTable.setFirstVisibleRow(0);
					bScrolled = true;
				}
			}

			return bScrolled;
		},

		/**
		 * Checks whether the cell of the given DOM reference is in the first row (from DOM point of view) of the scrollable area.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {Object} oRef Cell DOM Reference
		 * @private
		 */
		isFirstScrollableRow : function(oTable, oRef) {
			var $Ref = jQuery(oRef);
			var iRowIndex = parseInt($Ref.add($Ref.parent()).filter("[data-sap-ui-rowindex]").data("sap-ui-rowindex"), 10);
			var iFixed = oTable.getFixedRowCount() || 0;
			return iRowIndex == iFixed;
		},

		/**
		 * Checks whether the cell of the given DOM reference is in the last row (from DOM point of view) of the scrollable area.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {Object} oRef Cell DOM Reference
		 * @private
		 */
		isLastScrollableRow : function(oTable, oRef) {
			var $Ref = jQuery(oRef);
			var iRowIndex = parseInt($Ref.add($Ref.parent()).filter("[data-sap-ui-rowindex]").data("sap-ui-rowindex"), 10);
			var iFixed = oTable.getFixedBottomRowCount() || 0;
			return iRowIndex == oTable.getVisibleRowCount() - iFixed - 1;
		},

		/**
		 * Returns the content density style class which is relevant for the given control. First it tries to find the
		 * definition via the control API. While traversing the controls parents, it's tried to find the closest DOM
		 * reference. If that is found, the check will use the DOM reference to find the closest content density style class
		 * in the parent chain. This approach caters both use cases: content density defined at DOM and/or control level.
		 *
		 * If at the same level, several style classes are defined, this is the priority:
		 * sapUiSizeCompact, sapUiSizeCondensed, sapUiSizeCozy
		 *
		 * @param {sap.ui.table.Table} oControl Instance of the table
		 * @returns {String|undefined} name of the content density stlye class or undefined if none was found
		 * @private
		 */
		getContentDensity : function(oControl) {
			var sContentDensity;
			var aContentDensityStyleClasses = ["sapUiSizeCompact", "sapUiSizeCondensed", "sapUiSizeCozy"];

			var fnGetContentDensity = function (sFnName, oObject) {
				if (!oObject[sFnName]) {
					return;
				}

				for (var i = 0; i < aContentDensityStyleClasses.length; i++) {
					if (oObject[sFnName](aContentDensityStyleClasses[i])) {
						return aContentDensityStyleClasses[i];
					}
				}
			};

			var $DomRef = oControl.$();
			if ($DomRef.length > 0) {
				// table was already rendered, check by DOM and return content density class
				sContentDensity = fnGetContentDensity("hasClass", $DomRef);
			} else {
				sContentDensity = fnGetContentDensity("hasStyleClass", oControl);
			}

			if (sContentDensity) {
				return sContentDensity;
			}

			// since the table was not yet rendered, traverse its parents:
			//   - to find a content density defined at control level
			//   - to find the first DOM reference and then check on DOM level
			var oParentDomRef = null;
			var oParent = oControl.getParent();
			// the table might not have a parent at all.
			if (oParent) {
				// try to get the DOM Ref of the parent. It might be required to traverse the complete parent
				// chain to find one parent which has DOM rendered, as it may happen that an element does not have
				// a corresponding DOM Ref
				do {
					// if the content density is defined at control level, we can return it, no matter the control was already
					// rendered. By the time it will be rendered, it will have that style class
					sContentDensity = fnGetContentDensity("hasStyleClass", oParent);
					if (sContentDensity) {
						return sContentDensity;
					}

					// if there was no style class set at control level, we try to find the DOM reference. Using that
					// DOM reference, we can easily check for the content density style class via the DOM. This allows us
					// to include e.g. the body tag as well.
					if (oParent.getDomRef) {
						// for Controls and elements
						oParentDomRef = oParent.getDomRef();
					} else if (oParent.getRootNode) {
						// for UIArea
						oParentDomRef = oParent.getRootNode();
					}

					if (!oParentDomRef && oParent.getParent) {
						oParent = oParent.getParent();
					} else {
						// make sure there is not endless loop if oParent has no getParent function
						oParent = null;
					}
				} while (oParent && !oParentDomRef)
			}

			// if we found a DOM reference, check for content density
			$DomRef = jQuery(oParentDomRef || document.body);
			sContentDensity = fnGetContentDensity("hasClass", $DomRef.closest("." + aContentDensityStyleClasses.join(",.")));

			return sContentDensity;
		},

		/**
		 * Checks and returns an adapted selection mode (e.g. changes deprecated mode "Multi" to "MultiToggle") if necessary.
		 * @param {sap.ui.table.Table} oTable Instance of the table
		 * @param {string} sSelectionMode the <code>sap.ui.table.SelectionMode</code>
		 * @returns {string} the sanitized <code>sap.ui.table.SelectionMode</code>
		 * @private
		 */
		sanitizeSelectionMode: function(oTable, sSelectionMode) {
			if (sSelectionMode === SelectionMode.Multi) {
				sSelectionMode = SelectionMode.MultiToggle;
				jQuery.sap.log.warning("The selection mode 'Multi' is deprecated and must not be used anymore. Your setting was defaulted to selection mode 'MultiToggle'");
			}
			return sSelectionMode;
		},

		/**
		 * Checks if the given CSS width is not fix.
		 * @param {string} sWidth
		 * @returns {boolean} true if the width is flexible
		 * @private
		 */
		isVariableWidth: function(sWidth) {
			return !sWidth || sWidth == "auto" || sWidth.toString().match(/%$/);
		},

		/**
		 * Resizes one or more visible columns to the specified amount of pixels.
		 *
		 * In case a column span is specified:
		 * The span covers only visible columns. If columns directly after the column with index <code>iColumnIndex</code> are invisible they
		 * will be skipped and not be considered for resizing.
		 * The new width <code>iWidth</code> will be equally applied among all resizable columns in the span of visible columns,
		 * considering the minimum column width. The actual resulting width might differ due to rounding errors and the minimum column width.
		 *
		 * Resizing of a column won't be performed if the ColumnResize event is fired
		 * and execution of the default action is prevented in the event handler.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {int} iColumnIndex The index of a column. Must the the index of a visible column.
		 * @param {int} iWidth The width in pixel to set the column or column span to. Must be greater than 0.
		 * @param {boolean} [bFireEvent=true] Whether the ColumnResize event should be fired. The event will be fired for every resized column.
		 * @param {int} [iColumnSpan=1] The span of columns to resize beginning from <code>iColumnIndex</code>.
		 * @return {boolean} Returns <code>true</code>, if at least one column has been resized.
		 * @private
		 */
		resizeColumn: function(oTable, iColumnIndex, iWidth, bFireEvent, iColumnSpan) {
			if (oTable == null ||
				iColumnIndex == null || iColumnIndex < 0 ||
				iWidth == null || iWidth <= 0) {
				return false;
			}
			if (iColumnSpan == null || iColumnSpan <= 0) {
				iColumnSpan = 1;
			}
			if (bFireEvent == null) {
				bFireEvent = true;
			}

			var aColumns = oTable.getColumns();
			if (iColumnIndex >= aColumns.length || !aColumns[iColumnIndex].getVisible()) {
				return false;
			}

			var aVisibleColumns = [];
			for (var i = iColumnIndex; i < aColumns.length; i++) {
				var oColumn = aColumns[i];

				if (oColumn.getVisible()) {
					aVisibleColumns.push(oColumn);

					// Consider only the required amount of visible columns.
					if (aVisibleColumns.length === iColumnSpan) {
						break;
					}
				}
			}

			var aResizableColumns = [];
			for (var i = 0; i < aVisibleColumns.length; i++) {
				var oVisibleColumn = aVisibleColumns[i];
				if (oVisibleColumn.getResizable()) {
					aResizableColumns.push(oVisibleColumn);
				}
			}
			if (aResizableColumns.length === 0) {
				return false;
			}

			var iSpanWidth = 0;
			for (var i = 0; i < aVisibleColumns.length; i++) {
				var oVisibleColumn = aVisibleColumns[i];
				iSpanWidth += this.getColumnWidth(oTable, oVisibleColumn.getIndex());
			}

			var iPixelDelta = iWidth - iSpanWidth;
			var iSharedPixelDelta = Math.round(iPixelDelta / aResizableColumns.length);
			var bResizeWasPerformed = false;

			var oTableElement = oTable.getDomRef();

			// Fix Auto Columns if a column in the scrollable area was resized:
			// Set minimum widths of all columns with variable width except those in aResizableColumns.
			// As a result, flexible columns cannot shrink smaller as their current width after the resize
			// (see setMinColWidths in Table.js).
			if (!this.isFixedColumn(oTable, iColumnIndex)) {
				oTable._getVisibleColumns().forEach(function (col) {
					var width = col.getWidth(),
						colElement;
					if (oTableElement && aResizableColumns.indexOf(col) < 0 && TableUtils.isVariableWidth(width)) {
						colElement = oTableElement.querySelector('th[data-sap-ui-colid="' + col.getId() + '"]');
						if (colElement) {
							col._minWidth = Math.max(colElement.offsetWidth, TableUtils.ColumnUtils.getMinColumnWidth());
						}
					}
				});
			}

			// Resize all resizable columns. Share the width change (pixel delta) between them.
			for (var i = 0; i < aResizableColumns.length; i++) {
				var oResizableColumn = aResizableColumns[i];
				var iColumnWidth = this.getColumnWidth(oTable, oResizableColumn.getIndex());

				var iNewWidth = iColumnWidth + iSharedPixelDelta;
				var iColMinWidth = TableUtils.ColumnUtils.getMinColumnWidth();
				if (iNewWidth < iColMinWidth) {
					iNewWidth = iColMinWidth;
				}

				var iWidthChange = iNewWidth - iColumnWidth;

				// Distribute any remaining delta to the remaining columns.
				if (Math.abs(iWidthChange) < Math.abs(iSharedPixelDelta)) {
					var iRemainingColumnCount = aResizableColumns.length - (i + 1);
					iPixelDelta -= iWidthChange;
					iSharedPixelDelta = Math.round(iPixelDelta / iRemainingColumnCount);
				}

				if (iWidthChange !== 0) {
					var bExecuteDefault = true;

					if (bFireEvent) {
						bExecuteDefault = oTable.fireColumnResize({
							column: oResizableColumn,
							width: iNewWidth
						});
					}

					if (bExecuteDefault) {
						oResizableColumn.setWidth(iNewWidth + "px");
						bResizeWasPerformed = true;
					}
				}
			}

			return bResizeWasPerformed;
		},

		/**
		 * Returns the width of a visible column in pixels.
		 * In case the width is set to auto or in percentage, the <code>offsetWidth</code> of the columns DOM element will be returned.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {int} iColumnIndex The index of a column. Must be a visible column.
		 * @returns {int|null} Returns <code>null</code> if <code>iColumnIndex</code> is out of bound.
		 * 					   Returns 0, if the column is not visible, or not yet rendered, and its width is not specified in pixels.
		 * @private
		 */
		getColumnWidth: function(oTable, iColumnIndex) {
			if (oTable == null ||
				iColumnIndex == null || iColumnIndex < 0) {
				return null;
			}

			var aColumns = oTable.getColumns();
			if (iColumnIndex >= aColumns.length) {
				return null;
			}

			var oColumn = aColumns[iColumnIndex];
			var sColumnWidth = oColumn.getWidth();

			// If the columns width is "auto" or specified in percentage, get the width from the DOM.
			if (sColumnWidth === "" || sColumnWidth === "auto" || sColumnWidth.match(/%$/)) {
				if (oColumn.getVisible()) {
					var oColumnElement = oColumn.getDomRef();
					return oColumnElement != null ? oColumnElement.offsetWidth : 0;
				} else {
					return 0;
				}
			} else {
				return oTable._CSSSizeToPixel(sColumnWidth);
			}
		},

		/**
		 * Opens the context menu of a column or a data cell.
		 * If a column header cell or an element inside a column header cell is passed as the parameter <code>oElement</code>,
		 * the context menu of this column will be opened. If a data cell or an element inside a data cell is passed, then the context menu
		 * of this data cell will be opened.
		 * The context menu will not be opened, if the configuration of the table does not allow it, or one of the event handlers attached to the
		 * events <code>ColumnSelect</code> or <code>CellContextmenu</code> calls preventDefault().
		 *
		 * On mobile devices, when trying to open a column context menu, an column header cell menu is created instead with buttons to actually open
		 * the column context menu or to resize the column. If this function is called when this cell menu already exists, then it is closed
		 * and the column context menu is opened.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {jQuery|HtmlElement} oElement The header or data cell, or an element inside, for which to open the context menu.
		 * @param {boolean} [bHoverFirstMenuItem] If <code>true</code>, the first item in the opened menu will be hovered.
		 * @param {boolean} [bFireEvent=true] If <code>true</code>, an event will be fired.
		 * 									  Fires the <code>ColumnSelect</code> event when a column context menu should be opened.
		 * 									  Fires the <code>CellContextmenu</code> event when a data cell context menu should be opened.
		 * @private
		 *
		 * @see	openColumnContextMenu
		 * @see closeColumnContextMenu
		 * @see	openDataCellContextMenu
		 * @see closeDataCellContextMenu
		 * @see	applyColumnHeaderCellMenu
		 * @see removeColumnHeaderCellMenu
		 */
		openContextMenu: function(oTable, oElement, bHoverFirstMenuItem, bFireEvent) {
			if (oTable == null || oElement == null) {
				return;
			}
			if (bFireEvent == null) {
				bFireEvent = true;
			}

			var $Target = jQuery(oElement);

			var $TableCell = this.getCell(oTable, $Target);
			if ($TableCell === null) {
				return;
			}

			var oCellInfo = this.getCellInfo($TableCell);

			if (oCellInfo.type === this.CELLTYPES.COLUMNHEADER) {
				var iColumnIndex = this.getColumnHeaderCellInfo($TableCell).index;
				var bCellHasMenuButton = $TableCell.find(".sapUiTableColDropDown").length > 0;

				if (Device.system.desktop || bCellHasMenuButton) {
					this.removeColumnHeaderCellMenu(oTable, iColumnIndex);
					var bExecuteDefault = true;

					if (bFireEvent) {
						bExecuteDefault = oTable.fireColumnSelect({
							column: oTable._getVisibleColumns()[iColumnIndex]
						});
					}

					if (bExecuteDefault) {
						this.openColumnContextMenu(oTable, iColumnIndex, bHoverFirstMenuItem);
					}
				} else {
					this.applyColumnHeaderCellMenu(oTable, iColumnIndex);
				}

			} else if (oCellInfo.type === this.CELLTYPES.DATACELL) {
				// TODO: Think of a better way to get the indices.
				var sCellId = $TableCell.prop("id");
				var aCellIdAreas = sCellId.split("-");
				var iRowIndex = parseInt(aCellIdAreas[2].slice(3), 10);
				var iColumnIndex = parseInt(aCellIdAreas[3].slice(3), 10);
				var bExecuteDefault = true;

				if (bFireEvent) {
					var oColumn = oTable.getColumns()[iColumnIndex];
					var oRow = oTable.getRows()[iRowIndex];
					var oCell =  oRow.getCells()[iColumnIndex];

					var oRowBindingContext;
					var oRowBindingInfo = oTable.getBindingInfo("rows");
					if (oRowBindingInfo != null) {
						oRowBindingContext = oRow.getBindingContext(oRowBindingInfo.model);
					}

					var mParams = {
						rowIndex: oRow.getIndex(),
						columnIndex: iColumnIndex,
						columnId: oColumn.getId(),
						cellControl: oCell,
						rowBindingContext: oRowBindingContext,
						cellDomRef: $TableCell[0]
					};

					bExecuteDefault = oTable.fireCellContextmenu(mParams);
				}

				if (bExecuteDefault) {
					this.openDataCellContextMenu(oTable, iColumnIndex, iRowIndex, bHoverFirstMenuItem);
				}
			}
		},

		/**
		 * Opens the context menu of a column.
		 * If context menus of other columns are open, they will be closed.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {int} iColumnIndex The index of the column to open the context menu on.
		 * @param {boolean} [bHoverFirstMenuItem] If <code>true</code>, the first item in the opened menu will be hovered.
		 * @private
		 *
		 * @see openContextMenu
		 * @see closeColumnContextMenu
		 */
		openColumnContextMenu: function(oTable, iColumnIndex, bHoverFirstMenuItem) {
			if (oTable == null ||
				iColumnIndex == null || iColumnIndex < 0) {
				return;
			}
			if (bHoverFirstMenuItem == null) {
				bHoverFirstMenuItem = false;
			}

			var oColumns = oTable.getColumns();
			if (iColumnIndex >= oColumns.length) {
				return;
			}

			var oColumn = oColumns[iColumnIndex];
			if (!oColumn.getVisible()) {
				return;
			}

			// If column menus of other columns are open, close them.
			for (var i = 0; i < oColumns.length; i++) {
				if (oColumns[i] !== oColumn) {
					this.closeColumnContextMenu(oTable, i);
				}
			}

			oColumn._openMenu(oColumn.getDomRef(), bHoverFirstMenuItem);
		},

		/**
		 * Closes the context menu of a column.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {int} iColumnIndex The index of the column to close the context menu on.
		 * @private
		 *
		 * @see openContextMenu
		 * @see openColumnContextMenu
		 */
		closeColumnContextMenu: function(oTable, iColumnIndex) {
			if (oTable == null ||
				iColumnIndex == null || iColumnIndex < 0) {
				return;
			}

			var oColumns = oTable.getColumns();
			if (iColumnIndex >= oColumns.length) {
				return;
			}

			var oColumn = oColumns[iColumnIndex];
			var oMenu = oColumn.getMenu();

			oMenu.close();
		},

		/**
		 * Opens the context menu of a data cell.
		 * If a context menu of another data cell is open, it will be closed.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {int} iColumnIndex The column index of the data cell to open the context menu on.
		 * @param {int} iRowIndex The row index of the data cell to open the context menu on.
		 * @param {boolean} [bHoverFirstMenuItem] If <code>true</code>, the first item in the opened menu will be hovered.
		 * @private
		 *
		 * @see openContextMenu
		 * @see closeDataCellContextMenu
		 */
		openDataCellContextMenu: function(oTable, iColumnIndex, iRowIndex, bHoverFirstMenuItem) {
			if (oTable == null ||
				iColumnIndex == null || iColumnIndex < 0 ||
				iRowIndex == null || iRowIndex < 0 || iRowIndex >= TableUtils.getNonEmptyVisibleRowCount(oTable)) {
				return;
			}
			if (bHoverFirstMenuItem == null) {
				bHoverFirstMenuItem = false;
			}

			var oColumns = oTable.getColumns();
			if (iColumnIndex >= oColumns.length) {
				return;
			}

			var oColumn = oColumns[iColumnIndex];
			if (!oColumn.getVisible()) {
				return;
			}

			// Currently only filtering is possible in the default cell context menu.
			if (oTable.getEnableCellFilter() && oColumn.isFilterableByMenu()) {
				var oRow = oTable.getRows()[iRowIndex];

				// Create the menu instance the first time it is needed.
				if (oTable._oCellContextMenu == null) {

					if (oTable._Menu == null) {
						// TODO consider to load them async (should be possible as this method ends with an "open" call which is async by nature
						oTable._Menu = sap.ui.requireSync("sap/ui/unified/Menu");
						oTable._MenuItem = sap.ui.requireSync("sap/ui/unified/MenuItem");
					}

					oTable._oCellContextMenu = new oTable._Menu(oTable.getId() + "-cellcontextmenu");

					var oCellContextMenuItem = new oTable._MenuItem({
						text: oTable._oResBundle.getText("TBL_FILTER")
					});

					oCellContextMenuItem._onSelect = function (oColumn, iRowIndex) {
						// "this" is the table instance.
						var oRowContext = this.getContextByIndex(iRowIndex);
						var sFilterProperty = oColumn.getFilterProperty();
						var sFilterValue = oRowContext.getProperty(sFilterProperty);

						if (this.getEnableCustomFilter()) {
							this.fireCustomFilter({
								column: oColumn,
								value: sFilterValue
							});
						} else {
							this.filter(oColumn, sFilterValue);
						}
					};
					oCellContextMenuItem.attachSelect(oCellContextMenuItem._onSelect.bind(oTable, oColumn, oRow.getIndex()));

					oTable._oCellContextMenu.addItem(oCellContextMenuItem);
					oTable.addDependent(oTable._oCellContextMenu);

				// If the menu already was created, only update the menu item.
				} else {
					var oMenuItem = oTable._oCellContextMenu.getItems()[0];
					oMenuItem.mEventRegistry.select[0].fFunction = oMenuItem._onSelect.bind(oTable, oColumn, oRow.getIndex());
				}

				if (oTable._Popup == null) {
					oTable._Popup = sap.ui.requireSync("sap/ui/core/Popup");
				}

				// Open the menu below the cell if is is not already open.
				var oCell =  oRow.getCells()[iColumnIndex];
				var $Cell =  TableUtils.getParentDataCell(oTable, oCell.getDomRef());

				if ($Cell !== null && !TableUtils.isInGroupingRow($Cell)) {
					var eCell = $Cell[0];
					var Dock = oTable._Popup.Dock;

					var bMenuOpenAtAnotherDataCell = oTable._oCellContextMenu.bOpen && oTable._oCellContextMenu.oOpenerRef !== eCell;
					if (bMenuOpenAtAnotherDataCell) {
						this.closeDataCellContextMenu(oTable);
					}

					oTable._oCellContextMenu.open(bHoverFirstMenuItem, eCell, Dock.BeginTop, Dock.BeginBottom, eCell, "none none");
				}
			}
		},

		/**
		 * Closes the currently open data cell context menu.
		 * Index information are not required as there is only one data cell context menu object and therefore only this one can be open.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @private
		 *
		 * @see openContextMenu
		 * @see openDataCellContextMenu
		 */
		closeDataCellContextMenu: function(oTable) {
			if (oTable == null) {
				return;
			}

			var oMenu = oTable._oCellContextMenu;
			var bMenuOpen = oMenu != null && oMenu.bOpen;

			if (bMenuOpen) {
				oMenu.close();
			}
		},

		/**
		 * Applies a cell menu on a column header cell.
		 * Hides the column header cell and inserts an element containing two buttons in its place. One button to open the column context menu and
		 * one to resize the column. These are useful on touch devices.
		 *
		 * <b>Note: Multi Headers are currently not fully supported.</b>
		 * In case of a multi column header the menu will be applied in the first row of the column header. If this column header cell is a span,
		 * then the index of the first column of this span must be provided.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {int} iColumnIndex The column index of the column header to insert the cell menu in.
		 * @private
		 *
		 * @see openContextMenu
		 * @see removeColumnHeaderCellMenu
		 */
		applyColumnHeaderCellMenu: function(oTable, iColumnIndex) {
			if (oTable == null ||
				iColumnIndex == null || iColumnIndex < 0) {
				return;
			}

			var oColumns = oTable.getColumns();
			if (iColumnIndex >= oColumns.length) {
				return;
			}

			var oColumn = oColumns[iColumnIndex];

			if (oColumn.getVisible() && (oColumn.getResizable() || oColumn._menuHasItems())) {
				var $Column = oColumn.$();
				var $ColumnCell = $Column.find(".sapUiTableColCell");
				var bCellMenuAlreadyExists = $Column.find(".sapUiTableColCellMenu").length > 0;

				if (!bCellMenuAlreadyExists) {
					$ColumnCell.hide();

					var sColumnContextMenuButton = "";
					if (oColumn._menuHasItems()) {
						sColumnContextMenuButton = "<div class='sapUiTableColDropDown'></div>";
					}

					var sColumnResizerButton = "";
					if (oColumn.getResizable()) {
						sColumnResizerButton = "<div class='sapUiTableColResizer''></div>";
					}

					var $ColumnCellMenu = jQuery("<div class='sapUiTableColCellMenu'>" + sColumnContextMenuButton + sColumnResizerButton + "</div>");

					$Column.append($ColumnCellMenu);

					$Column.on("focusout",
						function(TableUtils, oTable, iColumnIndex) {
							TableUtils.removeColumnHeaderCellMenu(oTable, iColumnIndex);
							this.off("focusout");
						}.bind($Column, this, oTable, iColumnIndex)
					);
				}
			}
		},

		/**
		 * Removes a cell menu from a column header cell.
		 * Removes the cell menu from the dom and unhides the column header cell.
		 *
		 * @param {sap.ui.table.Table} oTable Instance of the table.
		 * @param {int} iColumnIndex The column index of the column header to remove the cell menu from.
		 * @private
		 *
		 * @see openContextMenu
		 * @see applyColumnHeaderCellMenu
		 */
		removeColumnHeaderCellMenu: function(oTable, iColumnIndex) {
			if (oTable == null ||
				iColumnIndex == null || iColumnIndex < 0) {
				return;
			}

			var oColumns = oTable.getColumns();
			if (iColumnIndex >= oColumns.length) {
				return;
			}

			var oColumn = oColumns[iColumnIndex];
			var $Column = oColumn.$();
			var $ColumnCellMenu = $Column.find(".sapUiTableColCellMenu");
			var bCellMenuExists = $ColumnCellMenu.length > 0;

			if (bCellMenuExists) {
				var $ColumnCell = $Column.find(".sapUiTableColCell");
				$ColumnCell.show();
				$ColumnCellMenu.remove();
			}
		}
	};

	TableGrouping.TableUtils = TableUtils; // Avoid cyclic dependency
	TableColumnUtils.TableUtils = TableUtils; // Avoid cyclic dependency

	return TableUtils;

}, /* bExport= */ true);