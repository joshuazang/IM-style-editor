/* Original, inline SVG UI icons. User content is never interpreted as markup. */
const MosaicIcons = {
  mosaic:'<rect x="3" y="3" width="7" height="11" rx="2"/><rect x="14" y="3" width="7" height="6" rx="2"/><rect x="3" y="18" width="7" height="3" rx="1.5"/><rect x="14" y="13" width="7" height="8" rx="2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16 16 4.5 4.5"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  pin:'<path d="M7 3h10l-2 5v4l3 4H6l3-4V8L7 3ZM12 16v5"/>',
  unpin:'<path d="M9 3h8l-2 5v2M6 16h12l-3-4M9 10v2l-3 4M12 16v5M3 3l18 18"/>',
  copy:'<rect x="8" y="7" width="12" height="14" rx="2"/><path d="M15 3H5a2 2 0 0 0-2 2v11"/>',
  export:'<path d="M3 19c1-8 5-11 11-11V3l7 8-7 7v-5c-5 0-8 2-11 6Z"/>',
  reply:'<path d="M21 19c-1-8-5-11-11-11V3l-7 8 7 7v-5c5 0 8 2 11 6Z"/>',
  edit:'<path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-5-3L4 16l-1 5Z"/>',
  select:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  import:'<path d="M4 15v5h16v-5M12 3v12m-5-5 5 5 5-5"/>',
  tag:'<path d="m3 4 9-1 9 9-9 9-9-9V4Z"/><circle cx="7.5" cy="7.5" r=".8"/>',
  untagged:'<path d="M3 9V4l9-1 9 9-5 5M12 21l-4-4M3 3l18 18"/><circle cx="7.5" cy="7.5" r=".7"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  merge:'<path d="M5 3v4c0 4 7 3 7 7v7M19 3v4c0 4-7 3-7 7m-4 3 4 4 4-4"/>',
  shield:'<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>'
};
function mosaicIcon(name) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  svg.innerHTML=MosaicIcons[name]||MosaicIcons.mosaic;
  return svg;
}
