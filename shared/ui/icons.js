/* Shared original SVG vectors. Only this fixed dictionary becomes markup. */
const imUiIcons = {
  formatQuote:'<path d="M4 4v16M9 6h3v3l-2 2m7-5h3v3l-2 2M9 15h11M9 19h7"/>',
  formatText:'<path d="m6 16 6-13 6 13M8 12h8M4 21h16"/>',
  formatClear:'<path d="m7 16 5-12 5 12M9 12h6M4 3l16 18M4 20h7"/>',
  formatBold:'<path d="M6 4h7a4 4 0 0 1 0 8H6Zm0 8h8a4 4 0 0 1 0 8H6Z" stroke-width="2.6"/>',
  formatStrike:'<path d="M18 7c-1-2-3-3-6-3-3 0-5 1.5-5 4 0 1.7 1 2.5 3 3M7 17c1 2 3 3 6 3 3 0 5-1.5 5-4 0-1.7-1-2.5-3-3M3 12h18"/>',
  formatBullet:'<circle cx="5" cy="6" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="18" r="1" fill="currentColor"/><path d="M10 6h11M10 12h11M10 18h11"/>',
  formatNumber:'<path d="m3 4 2-1v6M3 9h4M3 14c0-2 4-2 4 0 0 1-4 4-4 5h4M11 6h10M11 12h10M11 18h10"/>',
  formatChecklist:'<rect x="3" y="4" width="17" height="17" rx="3"/><path d="m7 12 3 3 6-7"/>',
  formatHeading:'<path d="M4 4v16M15 4v16M4 12h11M20 15v5"/>',
  formatParagraph:'<path d="M14 4v16M19 4v16M19 4H9a5 5 0 0 0 0 10h5"/>',
  textSize:'<path d="M3 5h12M9 5v14M5 19h8M16 11h6M19 11v8m-2 0h4"/>',
  mosaic:'<rect x="3" y="3" width="7" height="11" rx="2"/><rect x="14" y="3" width="7" height="6" rx="2"/><rect x="3" y="18" width="7" height="3" rx="1.5"/><rect x="14" y="13" width="7" height="8" rx="2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16 16 4.5 4.5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  toolbarMore:'<g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></g>',
  pin:'<path d="M7 3h10l-2 5v4l3 4H6l3-4V8L7 3ZM12 16v5"/>',
  unpin:'<path d="M9 3h8l-2 5v2M6 16h12l-3-4M9 10v2l-3 4M12 16v5M3 3l18 18"/>',
  copy:'<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M15 3H5a2 2 0 0 0-2 2v11"/>',
  export:'<path d="M3 19c1-8 5-11 11-11V3l7 8-7 7v-5c-5 0-8 2-11 6Z"/>',
  reply:'<path d="M21 19c-1-8-5-11-11-11V3l-7 8 7 7v-5c5 0 8 2 11 6Z"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-3L4 16l-1 5Z"/>',
  select:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  selectAll:'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="m7 12 3 3 7-7M7 18h10"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  import:'<path d="M4 15v5h16v-5M12 3v12m-5-5 5 5 5-5"/>',
  tag:'<path d="m3 4 9-1 9 9-9 9-9-9V4Z"/><circle cx="7.5" cy="7.5" r=".8"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18h1.2a2.3 2.3 0 0 0 1.7-3.8 1.6 1.6 0 0 1 1.2-2.6H18a3 3 0 0 0 3-3A8.7 8.7 0 0 0 12 3Z"/><circle cx="7.5" cy="9" r=".8"/><circle cx="11" cy="6.5" r=".8"/><circle cx="15.5" cy="7.5" r=".8"/><circle cx="6.7" cy="13" r=".8"/>',
  noColor:'<path d="m4 4 16 16M9 4l-4 7a6 6 0 0 0 9 8M13 6l6 7a5 5 0 0 1-1 5"/>',
  untagged:'<path d="M3 9V4l9-1 9 9-5 5M12 21l-4-4M3 3l18 18"/><circle cx="7.5" cy="7.5" r=".7"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  merge:'<path d="M5 3v4c0 4 7 3 7 7v7M19 3v4c0 4-7 3-7 7m-4 3 4 4 4-4"/>',
  shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>'
};
/* Selection controls keep IM's established viewBox and paths in both apps. */
const imSelectionIcons={
  tag:'<path d="M4 12V6a3 3 0 0 1 3-3h9l6 7a2 2 0 0 1 0 3l-6 6H10M5 16v8M1 20h8"/><circle cx="17" cy="10" r="1.4" fill="currentColor" stroke="none"/>',
  copy:'<path d="M9 6V4a2 2 0 0 1 2-2h6l6 6v12a2 2 0 0 1-2 2h-2M17 2v6h6M5 9h9a2 2 0 0 1 2 2v13H3V11a2 2 0 0 1 2-2Z"/>',
  export:'<path d="M3 22c0-10 4-15 12-15V2l10 10-10 9v-6c-5 0-9 2-12 7Z"/>',
  cancel:'<path d="m6 6 14 14M20 6 6 20"/>',
  delete:'<path d="M4 7h18M10 7V4h6v3M6 7l1.5 17h11L20 7M11 11v9M15 11v9"/>',
  more:'<g fill="currentColor" stroke="none"><circle cx="6" cy="14" r="1.8"/><circle cx="14" cy="14" r="1.8"/><circle cx="22" cy="14" r="1.8"/></g>'
};

/* Canonical top-control vectors: both adapters use these exact sizes and paths. */
const imToolbarIcons={
 calendarSearch:{size:22,viewBox:'0 0 24 24',stroke:1.8,markup:'<path d="M11 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v5M7 2v4m9-4v4"/><path d="M3 8h17V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2Z" fill="currentColor" stroke="none"/><circle cx="16.5" cy="16.5" r="4.5"/><path d="m20 20 2.5 2.5"/>'},
 // Archived two-slider vector; reserved for a future filtering control.

 filters:{size:22,viewBox:'0 0 24 24',stroke:1.8,markup:'<path d="M2 7h1m6 0h13M2 17h13m6 0h1"/><circle cx="6" cy="7" r="3"/><circle cx="18" cy="17" r="3"/>'},
 searchTags:{size:28,viewBox:'0 0 32 32',stroke:1.8,markup:'<circle cx="18" cy="11" r="7.5"/><path d="m23.5 16.5 6 6"/><path d="M5 21h7q1.5 0 2.5 1.5L17 25q1 1 0 2l-2.5 2.5Q13.5 31 12 31H5q-3 0-3-3v-4q0-3 3-3Z"/><circle cx="12" cy="26" r="1.2" fill="currentColor" stroke="none"/>'},
 untagged:{size:28,viewBox:'0 0 24 24',stroke:1.8,markup:'<path d="M4 9V5a2 2 0 0 1 2-2h8l7 7a2 2 0 0 1 0 3l-7 7a2 2 0 0 1-3 0l-4-4M3 3l18 18"/><circle cx="10" cy="7" r="1"/>'},
 searchOnly:{size:28,viewBox:'0 0 32 32',stroke:1.8,markup:'<circle cx="18" cy="11" r="7.5"/><path d="m23.5 16.5 6 6"/>'},
 more:{size:20,viewBox:'0 0 24 24',stroke:1.8,markup:imUiIcons.toolbarMore},
 check:{size:11,viewBox:'0 0 16 16',stroke:2.3,markup:'<path d="m3 8 3 3 7-7"/>'},
 cancel:{size:22,viewBox:'0 0 28 28',stroke:1.8,markup:imSelectionIcons.cancel}
};
