// Documento imprimible en una ventana nueva: el administrador lo guarda como PDF con el diálogo de impresión
// del navegador (RF-80, RF-96). Todo el texto se escapa antes de insertarlo.

export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function tablaHtml(columnas: string[], filas: unknown[][]) {
  if (filas.length === 0) return '<p class="vacio">Sin registros en este periodo.</p>'
  return `<table><thead><tr>${columnas.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr>${f.map(v => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
}

export function abrirImprimible(titulo: string, subtitulo: string, cuerpo: string) {
  const w = window.open('', '_blank', 'width=1000,height=800')
  if (!w) {
    alert('El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio y vuelve a intentarlo.')
    return
  }
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; color: #0C1C40; margin: 32px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid #E25900; padding-bottom: 4px; }
  .sub { color: #4B5563; margin: 0 0 16px; } .vacio { color: #667085; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #E6E9EE; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #F7F8F9; } dl { display: grid; grid-template-columns: 180px 1fr; gap: 4px 12px; margin: 0; } dt { color: #4B5563; }
  .marca { color: #E25900; font-weight: 700; } @media print { body { margin: 12mm; } }
</style></head><body>
<p class="marca">Click &amp; Serve · Panel de administración</p>
<h1>${escapeHtml(titulo)}</h1><p class="sub">${escapeHtml(subtitulo)}</p>${cuerpo}
<script>window.onload = () => setTimeout(() => window.print(), 200)</script>
</body></html>`)
  w.document.close()
}
