/** Which inputs a report reads, so the viewer only offers filters that apply. */
export type ReportFilter = 'campus' | 'date' | 'range';

export interface ReportCatalogItem {
  key: string;
  group: string;
  title: string;
  description: string;
  available: boolean;
  requires: string[];
  alsoRequires: string[];
  filters: ReportFilter[];
  /** Restricted to specific roles — Super Admin platform reports. */
  restricted: boolean;
}

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportSummaryTile {
  label: string;
  value: number;
  unit?: string;
  tone?: 'teal' | 'amber' | 'critical' | 'info';
}

export interface ReportPreview {
  key: string;
  title: string;
  description: string;
  group: string;
  columns: ReportColumn[];
  /** Column keys holding numbers — right-aligned and formatted in the table. */
  numeric: string[];
  rows: Record<string, unknown>[];
  summary: ReportSummaryTile[];
  chart: { label: string; rows: { label: string; value: number }[] } | null;
  totalRows: number;
  matchedRows: number;
  truncated: boolean;
  generatedAt: string;
}
