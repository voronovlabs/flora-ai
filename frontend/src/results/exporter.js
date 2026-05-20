// Export layer for the results panel. Today only CSV is wired; JSON
// and Excel slots are noted for future expansion (no library yet).

function rowsToCsv(rows, sep = ';') {
  if (!rows || rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const head = columns.join(sep);
  const body = rows.map((row) => columns.map((c) => {
    const v = row[c];
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Quote if the cell contains the separator or a newline.
    if (s.includes(sep) || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(sep)).join('\n');
  return head + '\n' + body;
}

function triggerDownload(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  // Defer revoke so Safari can finish the download.
  setTimeout(() => URL.revokeObjectURL(link.href), 5_000);
}

export const exporter = {
  csv(rows) {
    if (!rows || rows.length === 0) {
      alert('Нет данных для скачивания');
      return;
    }
    const csv = rowsToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `results_${new Date().toISOString().split('T')[0]}.csv`);
  },

  // Slots — explicitly not implemented. Listed so the next agent
  // touching this file knows where they go.
  json() { throw new Error('JSON export not yet implemented'); },
  xlsx() { throw new Error('XLSX export not yet implemented'); },
};
