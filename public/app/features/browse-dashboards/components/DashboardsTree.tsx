import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { TableInstance, useTable } from 'react-table';
import { FixedSizeList as List, ListOnScrollProps } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { GrafanaTheme2, isTruthy } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2 } from '@grafana/ui';
import { DashboardViewItem } from 'app/features/search/types';

import {
  DashboardsTreeCellProps,
  DashboardsTreeColumn,
  DashboardsTreeItem,
  INDENT_AMOUNT_CSS_VAR,
  SelectionState,
} from '../types';

import CheckboxCell from './CheckboxCell';
import CheckboxHeaderCell from './CheckboxHeaderCell';
import { NameCell } from './NameCell';
import { TagsCell } from './TagsCell';
import { TypeCell } from './TypeCell';
import { useCustomFlexLayout } from './customFlexTableLayout';

interface DashboardsTreeProps {
  items: DashboardsTreeItem[];
  width: number;
  height: number;
  canSelect: boolean;
  isSelected: (kind: DashboardViewItem | '$all') => SelectionState;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
  onAllSelectionChange: (newState: boolean) => void;
  onItemSelectionChange: (item: DashboardViewItem, newState: boolean) => void;

  isItemLoaded: (itemIndex: number) => boolean;
  requestLoadMore: (startIndex: number, endIndex: number) => void;
}

const HEADER_HEIGHT = 35;
const ROW_HEIGHT = 35;

function FixedNumber({ number }: { number?: number }) {
  const str = number?.toString() ?? '';
  return <span style={{ fontFamily: 'monospace', whiteSpace: 'pre' }}>{str.padStart(4)}</span>;
}

export function DashboardsTree({
  items,
  width,
  height,
  isSelected,
  onFolderClick,
  onAllSelectionChange,
  onItemSelectionChange,
  isItemLoaded,
  requestLoadMore,
  canSelect = false,
}: DashboardsTreeProps) {
  const styles = useStyles2(getStyles);

  const tableColumns = useMemo(() => {
    const indexColumn: DashboardsTreeColumn = {
      id: 'index',
      width: 0,
      Header: ({}) => <FixedNumber />,
      Cell: ({ row: { index } }: DashboardsTreeCellProps) => <FixedNumber number={index} />,
    };

    const checkboxColumn: DashboardsTreeColumn = {
      id: 'checkbox',
      width: 0,
      Header: CheckboxHeaderCell,
      Cell: CheckboxCell,
    };

    const nameColumn: DashboardsTreeColumn = {
      id: 'name',
      width: 3,
      Header: <span style={{ paddingLeft: 20 }}>Name</span>,
      Cell: (props: DashboardsTreeCellProps) => <NameCell {...props} onFolderClick={onFolderClick} />,
    };

    const typeColumn: DashboardsTreeColumn = {
      id: 'type',
      width: 1,
      Header: 'Type',
      Cell: TypeCell,
    };

    const tagsColumns: DashboardsTreeColumn = {
      id: 'tags',
      width: 2,
      Header: 'Tags',
      Cell: TagsCell,
    };
    const columns = [indexColumn, canSelect && checkboxColumn, nameColumn, typeColumn, tagsColumns].filter(isTruthy);

    return columns;
  }, [onFolderClick, canSelect]);

  const table = useTable({ columns: tableColumns, data: items }, useCustomFlexLayout);
  const { getTableProps, getTableBodyProps, headerGroups } = table;

  const virtualData = useMemo(
    () => ({
      table,
      isSelected,
      onAllSelectionChange,
      onItemSelectionChange,
    }),
    // we need this to rerender if items changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, isSelected, onAllSelectionChange, onItemSelectionChange, items]
  );

  const handleIsItemLoaded = useCallback(
    (itemIndex: number) => {
      return isItemLoaded(itemIndex);
    },
    [isItemLoaded]
  );

  const handleLoadMore = useCallback(
    (startIndex: number, endIndex: number) => {
      requestLoadMore(startIndex, endIndex);
    },
    [requestLoadMore]
  );

  return (
    <div {...getTableProps()} className={styles.tableRoot} role="table">
      {headerGroups.map((headerGroup) => {
        const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps({
          style: { width },
        });

        return (
          <div key={key} {...headerGroupProps} className={cx(styles.row, styles.headerRow)}>
            {headerGroup.headers.map((column) => {
              const { key, ...headerProps } = column.getHeaderProps();

              return (
                <div key={key} {...headerProps} role="columnheader" className={styles.cell}>
                  {column.render('Header', { isSelected, onAllSelectionChange })}
                </div>
              );
            })}
          </div>
        );
      })}

      <div {...getTableBodyProps()}>
        <InfiniteLoader itemCount={items.length} isItemLoaded={handleIsItemLoaded} loadMoreItems={handleLoadMore}>
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={height - HEADER_HEIGHT}
              width={width}
              itemCount={items.length}
              itemData={virtualData}
              itemSize={ROW_HEIGHT}
              onItemsRendered={onItemsRendered}
            >
              {VirtualListRow}
            </List>
          )}
        </InfiniteLoader>
      </div>
    </div>
  );
}

interface VirtualListRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    table: TableInstance<DashboardsTreeItem>;
    isSelected: DashboardsTreeCellProps['isSelected'];
    onAllSelectionChange: DashboardsTreeCellProps['onAllSelectionChange'];
    onItemSelectionChange: DashboardsTreeCellProps['onItemSelectionChange'];
  };
}

function VirtualListRow({ index, style, data }: VirtualListRowProps) {
  const styles = useStyles2(getStyles);
  const { table, isSelected, onItemSelectionChange } = data;
  const { rows, prepareRow } = table;

  const row = rows[index];
  prepareRow(row);

  return (
    <div
      {...row.getRowProps({ style })}
      className={cx(styles.row, styles.bodyRow)}
      data-testid={selectors.pages.BrowseDashbards.table.row(row.original.item.uid)}
    >
      {row.cells.map((cell) => {
        const { key, ...cellProps } = cell.getCellProps();

        return (
          <div key={key} {...cellProps} className={styles.cell}>
            {cell.render('Cell', { isSelected, onItemSelectionChange })}
          </div>
        );
      })}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    tableRoot: css({
      // Responsively
      [INDENT_AMOUNT_CSS_VAR]: theme.spacing(1),

      [theme.breakpoints.up('md')]: {
        [INDENT_AMOUNT_CSS_VAR]: theme.spacing(3),
      },
    }),

    // Column flex properties (cell sizing) are set by customFlexTableLayout.ts

    row: css({
      gap: theme.spacing(1),
    }),

    headerRow: css({
      backgroundColor: theme.colors.background.secondary,
      height: HEADER_HEIGHT,
    }),

    bodyRow: css({
      height: ROW_HEIGHT,

      '&:hover': {
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.03),
      },
    }),

    cell: css({
      padding: theme.spacing(1),
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),

    link: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
  };
};
