// Copyright (C) Microsoft Corporation.  All rights reserved.

import { useEffect, useState } from 'react';
import { StatisticResolver, TrackedStat } from '../StatisticResolver';
import { StatisticProvider, StatisticUpdatedMessage } from '../StatisticProvider';
import { VSCodeDataGrid, VSCodeDataGridCell, VSCodeDataGridRow } from '@vscode/webview-ui-toolkit/react';
import React from 'react';

interface StatisticColumn {
    statisticDataProvider: StatisticProvider;
    statisticResolver: StatisticResolver;
    label: string;
}

type MinecraftStatisticTableProps = {
    title: string;
    yLabel: string;
    xLabel?: string;
    statisticColumns: StatisticColumn[];
};

interface TableRowData {
    tick: number;
    cellData: Record<string, Record<string, number>>;
}

export default function MinecraftStatisticTable({
    title,
    yLabel,
    xLabel = 'Time',
    statisticColumns,
}: MinecraftStatisticTableProps) {
    // states
    const [data, setData] = useState<Record<string, TrackedStat[]>>({});
    const [rowData, setRowData] = useState<TableRowData[]>([]); // [{ tick: 0, cellData: { 'category1': 0, 'category2': 0 } }

    useEffect(() => {
        const eventHandlers: ((event: StatisticUpdatedMessage) => void)[] = [];

        for (const statColum of statisticColumns) {
            const eventHandler = (event: StatisticUpdatedMessage): void => {
                // Update data with new data point
                setData((prevState: Record<string, TrackedStat[]>): Record<string, TrackedStat[]> => {
                    const result = { ...prevState };

                    const previousColumnState = result[statColum.label] || [];
                    const newData = statColum.statisticResolver(event, previousColumnState);
                    result[statColum.label] = newData;

                    return result;
                });
            };

            statColum.statisticDataProvider.registerWindowListener(window);
            statColum.statisticDataProvider.addSubscriber(eventHandler);
            eventHandlers.push(eventHandler);
        }

        const newRowData: TableRowData[] = [];
        for (const statLabel of Object.keys(data)) {
            const statData = data[statLabel];

            for (const stat of statData) {
                const tick = stat.time;

                // Find row entry for tick
                let rowEntry: TableRowData | undefined = newRowData.find(row => row.tick === tick);
                if (rowEntry === undefined) {
                    newRowData.push({ tick: tick, cellData: {} });
                    rowEntry = newRowData[newRowData.length - 1];
                }

                // Find cell for statistic label
                let cellData: Record<string, number> | undefined = rowEntry.cellData[statLabel];
                if (cellData === undefined) {
                    rowEntry.cellData[statLabel] = {};
                    cellData = rowEntry.cellData[statLabel];
                }

                if (cellData !== undefined) {
                    cellData[stat.category!] = stat.value;
                }
            }
        }

        setRowData((): TableRowData[] => {
            const newData = [...newRowData];
            return newData;
        });

        // Remove old listener
        return () => {
            for (const statColum of statisticColumns) {
                for (const eventHandler of eventHandlers) {
                    statColum.statisticDataProvider.removeSubscriber(eventHandler);
                }
                statColum.statisticDataProvider.unregisterWindowListener(window);
            }
        };
    }, [data]);

    return (
        <VSCodeDataGrid generateHeader="sticky">
            <VSCodeDataGridRow row-type="sticky-header">
                <VSCodeDataGridCell cell-type="columnheader" grid-column="1">
                    Tick
                </VSCodeDataGridCell>
                {statisticColumns.map((column, index) => (
                    <VSCodeDataGridCell cell-type="columnheader" grid-column={index + 2}>
                        {column.label}
                    </VSCodeDataGridCell>
                ))}
            </VSCodeDataGridRow>
            {rowData.map(row => (
                <VSCodeDataGridRow>
                    <VSCodeDataGridCell grid-column="1">{row.tick}</VSCodeDataGridCell>
                    {statisticColumns.map((column, index) => (
                        <VSCodeDataGridCell grid-column={index + 2}>
                            {(Object.entries(row.cellData[column.label] ?? {}) ?? []).map(
                                ([category, value], index, array) => (
                                    <React.Fragment key={index}>
                                        {`${category}: ${value}`}
                                        {index < array.length - 1 && <br />}
                                    </React.Fragment>
                                )
                            )}
                        </VSCodeDataGridCell>
                    ))}
                </VSCodeDataGridRow>
            ))}
        </VSCodeDataGrid>
    );
}
