export function downloadCsv(filename: string, headers: string[], rows: (string | number | undefined)[][]) {
  const csv = [headers, ...rows].map((row) => row.map((value) => {
    const cell = String(value ?? "");
    // Keep spreadsheet apps from evaluating user-entered text as a formula.
    const text = typeof value === "string" && /^\s*[=+@-]/.test(cell) ? "'" + cell : cell;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");

  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
