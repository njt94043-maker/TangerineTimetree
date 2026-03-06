import { PDF_COLORS } from './colors';
import { getLogoDataUri } from './logo';
import { htmlEscape } from './htmlEscape';

export interface SetlistTemplateData {
  setlistName: string;
  description?: string;
  songs: Array<{
    position: number;
    name: string;
    artist: string;
    duration: string | null;
  }>;
  totalDuration: string | null;
  bandName: string;
  contactEmail: string;
  website: string;
  generatedDate: string;
}

export function getSetlistHtml(data: SetlistTemplateData): string {
  const songRows = data.songs.map(song => `
    <tr>
      <td class="pos">${song.position}</td>
      <td class="song-name">${htmlEscape(song.name)}</td>
      <td class="artist">${htmlEscape(song.artist)}</td>
      <td class="duration">${song.duration ?? '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; size: A4; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: ${PDF_COLORS.bodyText};
    background: #ffffff;
  }
  .header {
    background: linear-gradient(135deg, #08080c 0%, #1a1a2e 100%);
    padding: 32px 40px;
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .header-logo {
    width: 56px;
    height: 56px;
    border-radius: 10px;
  }
  .header-text {
    flex: 1;
  }
  .brand-name {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .brand-green { color: #00e676; }
  .brand-orange { color: #f39c12; }
  .header-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.6);
    margin-top: 4px;
    letter-spacing: 0.3px;
  }
  .accent-bar {
    height: 4px;
    background: linear-gradient(90deg, #00e676, #f39c12);
  }
  .content {
    padding: 28px 40px;
  }
  .setlist-title {
    font-size: 24px;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 4px;
  }
  .setlist-desc {
    font-size: 13px;
    color: #666;
    margin-bottom: 20px;
  }
  .setlist-meta {
    font-size: 11px;
    color: #999;
    margin-bottom: 20px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }
  th {
    text-align: left;
    background: #1a1a2e;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 10px 12px;
  }
  th:first-child { border-radius: 6px 0 0 0; width: 40px; text-align: center; }
  th:last-child { border-radius: 0 6px 0 0; width: 70px; text-align: right; }
  th.artist-col { width: 30%; }
  td {
    padding: 10px 12px;
    font-size: 13px;
    border-bottom: 1px solid #eee;
  }
  tr:nth-child(even) { background: #fafafa; }
  tr:hover { background: #f0f9f4; }
  .pos {
    text-align: center;
    font-weight: 700;
    color: #00e676;
    font-size: 14px;
  }
  .song-name {
    font-weight: 600;
    color: #1a1a2e;
  }
  .artist {
    color: #666;
    font-style: italic;
  }
  .duration {
    text-align: right;
    font-family: 'Courier New', monospace;
    color: #999;
    font-size: 12px;
  }
  .total-row {
    background: linear-gradient(135deg, #08080c 0%, #1a1a2e 100%);
    padding: 12px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #ffffff;
    font-size: 13px;
  }
  .total-label { font-weight: 600; }
  .total-value {
    font-family: 'Courier New', monospace;
    font-weight: 700;
    color: #00e676;
    font-size: 15px;
  }
  .footer {
    background: linear-gradient(135deg, #08080c 0%, #1a1a2e 100%);
    padding: 20px 40px;
    text-align: center;
    color: rgba(255,255,255,0.5);
    font-size: 10px;
    margin-top: auto;
  }
  .footer a { color: #00e676; text-decoration: none; }
  .footer-line { margin: 4px 0; }
</style>
</head>
<body>
  <div class="header">
    <img src="${getLogoDataUri()}" alt="Logo" class="header-logo" />
    <div class="header-text">
      <div class="brand-name"><span class="brand-green">Tangerine</span> <span class="brand-orange">Timetree</span></div>
      <div class="header-sub">${htmlEscape(data.bandName)} &mdash; Live Music Entertainment</div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <div class="content">
    <div class="setlist-title">${htmlEscape(data.setlistName)}</div>
    ${data.description ? `<div class="setlist-desc">${htmlEscape(data.description)}</div>` : ''}
    <div class="setlist-meta">${data.songs.length} song${data.songs.length !== 1 ? 's' : ''}${data.totalDuration ? ` &bull; ${data.totalDuration} total` : ''} &bull; ${htmlEscape(data.generatedDate)}</div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Song</th>
          <th class="artist-col">Artist</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        ${songRows}
      </tbody>
    </table>
  </div>

  ${data.totalDuration ? `
  <div class="total-row">
    <span class="total-label">Total Duration</span>
    <span class="total-value">${data.totalDuration}</span>
  </div>
  ` : ''}

  <div class="footer">
    <div class="footer-line">${htmlEscape(data.bandName)}</div>
    <div class="footer-line"><a href="mailto:${htmlEscape(data.contactEmail)}">${htmlEscape(data.contactEmail)}</a> &bull; <a href="https://${htmlEscape(data.website)}">${htmlEscape(data.website)}</a></div>
  </div>
</body>
</html>`;
}
