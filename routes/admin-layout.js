module.exports = (title, content, activePage = '') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — MFC Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d14; color: #e2e8f0; display: flex; min-height: 100vh; }
    .sidebar { width: 220px; background: #12121f; border-right: 1px solid #1e1e30; padding: 24px 0; flex-shrink: 0; position: fixed; top: 0; left: 0; height: 100vh; overflow-y: auto; }
    .sidebar-logo { padding: 0 20px 24px; font-size: 15px; font-weight: 700; color: #a78bfa; border-bottom: 1px solid #1e1e30; margin-bottom: 16px; }
    .sidebar a { display: block; padding: 10px 20px; color: #94a3b8; text-decoration: none; font-size: 14px; transition: all 0.15s; }
    .sidebar a:hover, .sidebar a.active { background: #1e1e35; color: #a78bfa; }
    .sidebar a.active { border-left: 3px solid #a78bfa; }
    .sidebar-section { padding: 8px 20px 4px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #475569; margin-top: 8px; }
    .main { margin-left: 220px; flex: 1; padding: 32px; }
    .page-title { font-size: 24px; font-weight: 700; color: #f1f5f9; margin-bottom: 24px; }
    .card { background: #12121f; border: 1px solid #1e1e30; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
    .card-title { font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat { background: #12121f; border: 1px solid #1e1e30; border-radius: 12px; padding: 20px; }
    .stat-num { font-size: 32px; font-weight: 700; color: #a78bfa; }
    .stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; color: #64748b; font-weight: 600; border-bottom: 1px solid #1e1e30; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 12px; border-bottom: 1px solid #1a1a2e; color: #cbd5e1; vertical-align: top; }
    tr:hover td { background: #16162a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #064e3b; color: #6ee7b7; }
    .badge-gray { background: #1e293b; color: #64748b; }
    .badge-purple { background: #3b0764; color: #c4b5fd; }
    input, textarea, select { background: #1a1a2e; border: 1px solid #2d2d4a; color: #e2e8f0; padding: 10px 12px; border-radius: 8px; font-size: 14px; width: 100%; outline: none; font-family: inherit; }
    input:focus, textarea:focus, select:focus { border-color: #7c3aed; }
    textarea { resize: vertical; min-height: 80px; }
    label { display: block; font-size: 13px; color: #94a3b8; margin-bottom: 6px; font-weight: 500; }
    .form-group { margin-bottom: 16px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; text-decoration: none; }
    .btn-primary { background: linear-gradient(135deg, #7c3aed, #06b6d4); color: white; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-danger { background: #7f1d1d; color: #fca5a5; }
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .btn-ghost { background: #1e1e35; color: #94a3b8; }
    .btn-ghost:hover { background: #2d2d4a; color: #e2e8f0; }
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .alert-success { background: #064e3b; color: #6ee7b7; border: 1px solid #065f46; }
    .alert-error { background: #7f1d1d; color: #fca5a5; border: 1px solid #991b1b; }
    .slug-preview { font-family: monospace; color: #06b6d4; font-size: 13px; background: #0d1117; padding: 4px 8px; border-radius: 4px; }
    .empty { text-align: center; padding: 48px; color: #475569; }
    .flex { display: flex; align-items: center; gap: 12px; }
    .flex-between { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  </style>
</head>
<body>
  <nav class="sidebar">
    <div class="sidebar-logo">🤖 MFC Admin</div>
    <div class="sidebar-section">Overview</div>
    <a href="/admin/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">📊 Dashboard</a>
    <a href="/admin/signups" class="${activePage === 'signups' ? 'active' : ''}">📧 Signups</a>
    <div class="sidebar-section">Landing Pages</div>
    <a href="/admin/variants" class="${activePage === 'variants' ? 'active' : ''}">🧪 Variants & A/B Test</a>
    <div class="sidebar-section">Content</div>
    <a href="/admin/vsl" class="${activePage === 'vsl' ? 'active' : ''}">🎬 VSL Video</a>
    <a href="/admin/testimonials" class="${activePage === 'testimonials' ? 'active' : ''}">💬 Testimonials</a>
    <a href="/admin/settings" class="${activePage === 'settings' ? 'active' : ''}">⚙️ Site Settings</a>
    <div class="sidebar-section">Growth</div>
    <a href="/admin/tracking" class="${activePage === 'tracking' ? 'active' : ''}">🔗 Tracking Links</a>
    <a href="/admin/events" class="${activePage === 'events' ? 'active' : ''}">📅 Events & Calendar</a>
    <a href="/" target="_blank" style="margin-top:16px">🌐 View Site</a>
    <a href="/admin/logout">🚪 Logout</a>
  </nav>
  <main class="main">
    <div class="page-title">${title}</div>
    ${content}
  </main>
  <script>
    function copyToClipboard(text) { navigator.clipboard.writeText(text); }
  </script>
</body>
</html>`;
