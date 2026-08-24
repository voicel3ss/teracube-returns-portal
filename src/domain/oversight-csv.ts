type OversightCsvRow = {
  orderNumber: number;
  deviceSerial: string | null;
  model: string;
  statusLabel: string;
  stage: string;
  issue: string;
  flow: string | null;
  needsAttention: boolean;
  updatedAt: string;
  assignments: Array<{ name: string; work: string; team: string }>;
  parentEmail?: string;
  shippingAddress?: string;
};

const operationalHeaders = [
  "Case",
  "Serial",
  "Model",
  "Current status",
  "Current team",
  "Assigned personnel",
  "Assigned work",
  "Customer issue",
  "Replacement flow",
  "Needs attention",
  "Last updated",
];
const piiHeaders = ["Parent email", "Shipping address"];

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildOversightCsv(rows: OversightCsvRow[]): string {
  const includePii = rows.some((row) => row.parentEmail !== undefined || row.shippingAddress !== undefined);
  const body = rows.map((row) => [
    `#${String(row.orderNumber).padStart(4, "0")}`,
    row.deviceSerial ?? "",
    row.model,
    row.statusLabel,
    row.stage,
    row.assignments.map((assignment) => assignment.name).join("; ") || "Unassigned",
    row.assignments.map((assignment) => `${assignment.work} (${assignment.team})`).join("; "),
    row.issue,
    row.flow ?? "",
    row.needsAttention ? "Yes" : "No",
    row.updatedAt,
    ...(includePii ? [row.parentEmail ?? "", row.shippingAddress ?? ""] : []),
  ].map(csvCell).join(","));
  return [[...operationalHeaders, ...(includePii ? piiHeaders : [])].map(csvCell).join(","), ...body].join("\r\n");
}
