/* Original, directly authored SVG curves. No raster input or tracing dependency. */
import {writeFileSync} from 'node:fs';

const W=1254,H=1881;
const motifs=[];
const p=d=>`<path d="${d}"/>`;
const e=(x,y,rx,ry=rx)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/>`;
const l=(x,y,a,b)=>p(`M${x} ${y}L${a} ${b}`);
const detail=body=>`<g stroke-width="1.05">${body}</g>`;
const group=(body,transform)=>`<g transform="${transform}">${body}</g>`;
const define=(id,body,rx=49,ry=49)=>motifs.push({id,body,rx,ry});
const dots=(points,r=1.4)=>points.map(([x,y])=>e(x,y,r)).join('');
const star=(x,y,r=5)=>p(`M${x} ${y-r}Q${x+1} ${y-1} ${x+r} ${y}Q${x+1} ${y+1} ${x} ${y+r}Q${x-1} ${y+1} ${x-r} ${y}Q${x-1} ${y-1} ${x} ${y-r}Z`);
const leaf=(x,y,a=0,s=1)=>group(p('M0 0C-12-9-9-23 0-28C11-20 13-8 0 0ZM0 0Q-3-14 0-25'),'translate('+x+' '+y+') rotate('+a+') scale('+s+')');
const sprig=(x,y,a=0,s=1)=>group(p('M0 0C3-15-3-31 1-47')+[-8,-19,-31].map((v,i)=>p(`M1 ${v}C-14 ${v-2}-16 ${v-10}-14 ${v-14}C-4 ${v-12} 0 ${v-5} 1 ${v}M1 ${v-4}C13 ${v-7} 17 ${v-15} 13 ${v-18}C5 ${v-16} 2 ${v-10} 1 ${v-4}`)).join(''),'translate('+x+' '+y+') rotate('+a+') scale('+s+')');
const book=()=>p('M9 32Q27 21 49 31Q70 20 91 31L88 77Q68 68 50 80Q29 69 11 78ZM49 31L50 80M14 83Q32 76 50 85Q69 75 86 82')+detail(p('M18 40Q32 34 42 39M18 48Q32 42 42 47M18 56Q32 50 42 55M18 64Q32 58 42 63M59 39Q72 33 82 38M59 47Q72 41 82 46M59 55Q72 49 82 54M59 63Q72 57 82 62'));
const stack=()=>p('M13 74Q47 70 84 74L87 86Q51 82 13 88Q7 82 13 74ZM13 79Q45 75 79 79M18 65Q47 61 79 66L79 73M18 69Q44 65 74 69');
const mushroom=(x,y,s=1)=>group(p('M-16 0C-13-25 13-25 17 0Q0-5-16 0ZM-3-2Q-8 15-4 23Q0 26 5 22Q7 14 4-2')+detail(p('M-11-2L-2-7M11-2L3-7M0 24Q-4 15 0 2'))+dots([[-5,-11],[6,-12]],1.1),'translate('+x+' '+y+') scale('+s+')');
const shell=(x,y,s=1)=>group(p('M14 14C-8 24-26 1-14-17C-3-33 23-23 23-5C23 10 1 16-7 5C-14-6 4-15 10-6C14 1 3 5 0 0')+detail(p('M-18 1L-8 0M-15-10L-6-6M-6-21L-2-11M7-24L5-12M18-17L12-9M23-6L14-4M20 6L12 1M12 14L7 6')),'translate('+x+' '+y+') scale('+s+')');
const tentacle=(x,y,s=1)=>group(p('M0 29C-21 14-24-11-8-20C7-28 23-15 15-4C9 4-1-3 5-9M8 29C-7 12-16-7-5-13C4-18 14-10 8-7')+detail(dots([[-8,8],[-10,1],[-9,-6]],1.2)),'translate('+x+' '+y+') scale('+s+')');

define('ufo',p('M9 56C19 38 81 38 92 55C84 75 20 76 9 56ZM27 44C30 15 68 15 75 44M17 59Q50 70 85 58M36 75L26 89M50 77L50 94M65 75L75 89')+detail(p('M35 37C41 27 54 24 64 30'))+e(31,53,4,2.5)+e(50,51,4,2.5)+e(69,53,4,2.5)+star(16,24,4),49,40);
define('bigfoot',p('M40 19C37 7 58 5 62 16L69 25L67 32C79 39 85 52 86 65Q84 73 78 68L68 49Q70 65 64 77L77 86Q81 93 70 94L57 89L52 72L46 88L34 94Q24 95 26 88L35 77L34 49L22 65Q17 70 13 64C15 49 21 37 36 30L35 25Z')+detail(p('M42 23Q50 18 57 23M45 29Q51 33 58 28M36 37L40 42L43 37M61 37L65 42M39 52Q48 61 61 52M47 62L51 65L55 61'))+dots([[45,24],[55,24]],.8),40,46);
define('temple',p('M8 89H94V80H85V67H77V54H70V41H64V29H36V41H29V54H22V67H15V80H8ZM36 29V15H64V29M43 29V20H56V29M43 41L36 88M57 41L64 88')+detail([47,54,61,68,75,82].map(y=>l(42-(y-47)*.14,y,58+(y-47)*.14,y)).join('')+p('M29 55H38M63 55H72M23 68H36M65 68H80M16 81H34M67 81H86'))+sprig(13,86,-35,.45)+star(78,22,5),49,43);
define('observatory',p('M20 86V46H80V86ZM17 46H83M24 40C25 8 74 8 77 40ZM48 15V40M50 19Q62 25 65 39M31 86V66Q36 57 43 66V86M60 58H72V71H60ZM12 88H90')+detail(p('M22 75H29M46 78H55M57 85V76M69 47V53M23 57H43'))+star(84,18,5),44,42);
define('vine-gateway',p('M13 91V40C13 2 86 2 86 40V91H72V43C72 16 28 16 28 43V91ZM9 94H91M16 48H27M16 65H27M74 48H84M74 65H84M19 31L31 36M28 17L36 27M44 12L45 23M65 14L60 26M80 26L69 34')+sprig(14,94,-17,.85)+leaf(86,47,25,.6)+detail(p('M43 90L42 81L51 76L59 82L58 90M48 72Q49 55 53 47')),43,47);
define('stone-mask',p('M28 16Q50 5 73 16L80 49Q72 78 51 93Q29 79 20 49ZM30 24Q50 16 70 24M31 38Q39 30 46 38Q39 45 31 38ZM56 38Q63 30 70 38Q63 45 56 38ZM48 42L42 61H58L53 42M36 70Q51 78 65 69M37 77Q51 85 64 76')+e(19,48,7,13)+e(81,48,7,13)+detail(p('M30 50L35 57L31 63M71 50L67 57L71 63M38 19L39 26M61 19L60 26')),40,46);
define('tent',p('M9 87L42 17Q47 12 51 17L93 85Q54 78 9 87ZM43 18L48 80M43 34L25 82M43 34L43 81M46 24Q61 45 82 79M17 70L5 92M82 70L96 93M5 93H12M91 94H98')+detail(p('M52 79L53 47L69 79M17 85Q30 89 46 84'))+star(78,23,4),48,43);
define('storm-lantern',p('M32 25Q24 4 49 7Q75 4 67 25M30 25H70L75 34H25ZM29 34L25 79Q50 91 75 79L71 34M26 81L21 89Q50 98 79 89L74 81M36 37L35 76M64 37L65 76')+p('M47 76C32 64 52 55 49 43C68 62 65 74 55 77ZM32 23Q50 18 67 23')+detail(p('M30 79Q50 85 70 79M40 27H60')),34,46);
define('crescent-compass',p('M67 12C17 7 9 81 62 86C35 69 35 32 67 12Z')+e(51,49,22)+p('M51 29L55 44L71 49L55 53L51 69L47 54L32 49L47 45ZM49 87V94M56 87V94M46 94H60')+detail(e(21,48,3)+p('M53 34V41M62 49H68M51 58V65M35 49H42'))+e(49,6,3),36,47);
define('armillary-sphere',e(50,44,37,32)+e(50,44,16,32)+e(50,44,37,11)+group(e(50,44,39,10),'rotate(-28 50 44)')+p('M50 8V79M39 78H61L69 89H31ZM29 92H71')+detail(p('M20 28Q50 37 79 28M20 59Q50 50 79 59'))+star(50,43,4),43,47);
define('folded-map',p('M8 25L34 15L65 23L91 12L92 80L66 91L35 82L9 94ZM34 15L35 82M65 23L66 91')+detail(p('M16 56L23 39L30 52M42 68L49 51L58 70M72 35L81 23L87 36M17 72Q28 61 40 68Q55 79 67 61Q72 49 82 48'))+e(20,76,3)+p('M78 46L85 53M85 46L78 53'),45,43);
define('expedition-pack',p('M29 21C29 2 72 2 71 21M25 22Q50 13 76 24L82 78Q77 94 24 91L18 76ZM25 25L26 42Q50 53 76 41L75 25M37 46V59H44V47M59 47V59H66V46M29 65Q51 60 73 67L72 83H29ZM19 45H10V75H19M80 45H90V75H81')+detail(p('M32 72H68M32 77H68M23 26Q50 21 78 28M34 10V18M66 10V18')),43,47);
define('binoculars',p('M15 72L22 31Q31 18 43 29L46 63M55 64L59 29Q71 17 81 31L88 73M44 47Q50 41 58 47M45 59Q50 53 56 59')+e(29,73,16,19)+e(72,73,16,19)+e(29,73,11,14)+e(72,73,11,14)+p('M24 23C22 5 78 5 78 23')+detail(p('M24 32Q31 27 39 32M63 32Q71 26 78 32')),42,45);
define('rope-coil',p('M68 80C25 101 2 54 20 24C33 1 84 4 91 39C97 68 67 88 42 74C22 63 26 25 51 23C75 20 87 47 70 60C52 76 36 57 43 42C50 29 70 37 64 49C62 54 55 55 53 50')+detail(p('M16 50L25 51M20 28L29 34M35 12L39 24M58 10L56 23M81 23L71 31M91 46L79 46M79 68L71 60M56 78L55 66'))+p('M68 81Q63 92 75 97M73 94L79 93M71 90L77 88'),44,48);
define('ammonite',shell(49,51,1.8)+p('M74 77Q82 81 87 91M69 83Q72 91 71 96'),46,49);
define('trilobite',p('M50 7C26 8 22 32 27 46C19 70 32 92 50 96C70 91 82 69 73 46C79 30 73 8 50 7ZM40 13Q28 28 37 44L36 71Q40 87 50 94Q60 87 64 71L63 44Q72 28 60 13M28 32Q50 45 73 32')+detail([45,53,61,69,77,85].map(y=>p(`M28 ${y}Q50 ${y+10} 72 ${y}M36 ${y+4}Q50 ${y+10} 64 ${y+4}`)).join('')+p('M43 20V30M58 20V30M50 12V36')),33,48);
define('quartz-cluster',p('M31 85L21 29L40 9L54 29L48 77M21 29L34 35L40 9M34 35L41 82M48 76L58 39L77 29L86 48L67 90M58 39L69 47L77 29M69 47L62 88M27 85L9 59L17 48L34 64M9 59L21 62L17 48M21 62L38 88M25 89Q50 99 77 90')+detail(p('M55 84L71 77M29 76L39 73')),42,47);
define('nautilus-bottle',p('M38 9H62V20H38ZM40 20V31C39 37 28 36 28 49V88Q50 94 73 88V49C73 36 61 37 60 31V20M38 14H62')+group(shell(0,0,1),'translate(49 65) scale(.65)')+detail(p('M34 51V78M36 84Q50 87 65 84M44 24H56')),29,45);
define('submarine-in-bottle',p('M12 34L26 34L36 26Q48 23 62 29L83 41Q95 56 83 73Q60 88 38 77L26 66H12ZM8 32H18V69H8ZM17 41H26M18 60H26')+group(p('M-19 1C-19-13 14-13 19-1C22 11-10 15-19 1ZM-2-10V-19H7M18 0H27M26-4V7')+e(-9,0,3)+e(2,0,3)+e(12,0,3),'translate(56 53) scale(.85)')+detail(p('M39 34Q59 31 77 46M41 71Q56 77 72 68')),46,32);
define('antique-key',e(34,27,19,21)+e(34,27,10,12)+p('M29 47V91H39V80H51V72H39V64H47V57H39V47')+p('M34 12L37 23L45 27L37 31L34 41L31 31L23 27L31 23Z')+detail(p('M32 52H36M32 87H36')),28,46);
define('beetle',p('M38 30Q27 9 50 7Q72 9 62 30M31 35Q50 21 69 35C90 61 68 91 50 94C28 88 11 60 31 35ZM50 34V92M37 18L25 10M63 18L75 10M28 44L15 36L8 40M24 61L11 61L7 69M32 78L20 88L22 96M73 44L86 36L93 40M76 61L89 61L94 69M69 78L81 88L80 96')+detail(p('M39 40C27 58 34 76 44 85M61 40C73 58 66 76 56 85')),45,47);
define('luna-moth',p('M47 33C29 10 4 3 9 30Q8 50 39 53C17 55 19 75 40 71L33 94Q46 89 48 62M53 33C72 10 96 3 91 30Q92 50 61 53C83 55 81 75 60 71L67 94Q54 89 52 62M47 29Q50 23 53 29L54 58Q50 68 46 58ZM48 28Q42 16 36 20M52 28Q58 16 64 20')+e(24,34,7,5)+e(76,34,7,5)+detail(p('M13 21Q29 26 43 43M10 42Q29 39 43 49M24 62L43 57M87 21Q71 26 57 43M90 42Q71 39 57 49M76 62L57 57')),46,48);
define('giant-squid',p('M43 45C25 36 34 9 49 3C66 11 75 35 57 45M34 30L20 44L40 39M65 30L80 44L61 39M43 44C14 56 14 85 29 87C41 89 40 74 32 76M45 47C35 67 42 94 54 94C69 94 67 73 58 75M55 46C79 49 94 77 81 84C68 89 69 73 76 75M42 48C17 52 4 66 10 76M57 45C78 42 95 52 95 64')+e(43,39,3)+e(58,39,3)+detail(dots([[25,61],[23,68],[26,76],[50,63],[50,71],[53,81],[75,59],[80,65]],1.1)),47,48);
define('diving-helmet',p('M23 69V38C23 5 79 5 79 38V69L88 82L84 92H16L12 82ZM19 72Q50 82 82 72M17 82Q50 91 85 82')+e(50,44,22)+e(50,44,15)+e(20,49,6,13)+e(81,49,6,13)+p('M50 29V59M35 44H65M42 14V8H59V14')+detail(dots([[50,19],[25,28],[75,28],[28,65],[72,65],[22,85],[79,85]],1.4)),42,45);
define('mushroom-helmet',p('M23 69V38C23 5 79 5 79 38V69L88 82L84 92H16L12 82ZM19 72Q50 82 82 72M17 82Q50 91 85 82')+e(50,44,22)+e(50,44,15)+mushroom(49,43,.7)+mushroom(75,16,.55)+sprig(18,77,-20,.55)+detail(dots([[50,19],[25,28],[28,65],[72,65]],1.2)),43,47);
define('jellyfish',p('M13 41C13 0 86 0 87 41Q78 52 69 42Q59 53 50 42Q39 53 31 42Q20 52 13 41ZM50 9Q30 15 28 39M50 9Q68 16 72 39M50 9V40M25 49C13 64 38 72 25 93M38 48C27 62 46 74 38 88M50 49C39 69 63 77 50 97M64 48C55 64 75 72 64 90M77 49C66 64 87 72 78 94'),41,48);
define('submarine',p('M13 44C14 23 79 23 86 44C93 70 19 76 13 52ZM42 28V17H58V27M50 17V8H63M86 43H95V59H88M93 36V66M9 46H3V58H12')+e(30,47,7)+e(51,47,7)+e(71,47,7)+detail(p('M24 64Q51 71 77 62M24 31Q51 24 75 33'))+dots([[28,47],[49,47],[69,47]],1),49,35);
define('wrecked-galleon',p('M9 67Q47 76 90 64L79 88Q42 99 20 84ZM14 76Q46 87 84 76M44 69V10M67 70V25M44 14L14 53Q28 59 43 51ZM48 15Q56 27 62 48Q56 55 48 53ZM68 28L84 55Q76 62 68 56ZM13 92Q21 85 31 92Q41 99 51 92Q61 85 71 92Q81 98 92 90')+detail(p('M24 79L29 88M41 83V92M60 82V92M78 79L73 88M44 11L59 9L48 17')),45,46);
define('anglerfish',p('M20 51C30 19 72 21 83 47Q73 53 83 65C63 85 30 83 20 57L7 69L11 53L6 38ZM83 47Q70 57 83 65M49 28C44 4 83 5 80 25')+e(80,27,5)+e(64,44,4)+p('M36 29L42 18L50 28M34 77L44 88L50 79M72 51L77 56L71 60')+detail(p('M21 47L28 51L22 59M35 39Q44 33 54 36M38 68Q48 74 58 70')),45,43);
define('nautilus',shell(44,46,1.65)+p('M65 64C86 59 95 67 84 74M67 69C89 67 96 79 82 84M63 76C82 79 89 91 75 91M58 79C71 89 69 97 60 94'),47,49);
define('sea-bell',p('M25 65C30 53 27 28 50 26C74 28 70 54 77 65L85 76Q50 91 16 76ZM23 71Q50 81 78 71M46 81Q44 96 54 91Q58 87 55 82M45 26C25 13 41-3 54 5C67 13 52 23 48 14M52 26C37 16 44 7 50 10')+detail(e(35,51,3)+e(63,59,4)+e(41,65,2)+p('M34 37Q42 28 54 32'))+sprig(12,86,-25,.55),42,47);
define('coral-garden',p('M48 95C47 70 57 48 51 17M51 41C36 37 27 27 29 12M50 63C27 62 18 47 16 28M50 78C68 70 79 54 75 34M53 49C72 43 80 32 81 17M29 28Q20 29 13 19M29 22Q38 20 36 10M23 51Q10 53 7 43M71 60Q86 63 91 51M76 39Q65 37 65 28M52 26Q64 21 63 9')+detail(p('M42 94Q40 77 31 75M60 93Q65 80 75 81'))+dots([[51,12],[29,8],[81,12],[16,23],[91,47]],2),44,47);
define('mushroom-grove',mushroom(46,40,1.3)+mushroom(19,72,.75)+mushroom(78,66,.9)+sprig(55,97,25,.6)+p('M15 93Q39 88 69 95')+detail(p('M30 36L42 26M56 33L49 27M45 61Q39 75 44 85')),43,45);
define('fern-frond',sprig(48,95,-9,1.65)+sprig(48,95,45,1.1)+sprig(48,95,-50,.8)+detail(p('M49 94Q72 98 78 90')),44,47);
define('garden-snail',p('M20 71C22 27 70 20 75 54Q83 72 64 80M12 77Q24 88 65 85L91 77Q96 66 87 63L78 64M84 64L80 48M91 64L96 49M11 77Q3 83 8 88Q41 95 89 86')+p('M60 75C27 88 23 48 43 42C63 35 76 61 60 67C45 75 35 56 48 53Q58 50 57 59')+e(79,45,3)+e(97,46,3)+leaf(16,61,-35,.55),48,34);
define('hollow-tree',p('M24 91Q36 72 31 49L25 18L35 30L40 6L46 35L56 25L71 8L64 39L78 31L69 52Q69 78 84 91M16 93Q29 88 37 93Q50 98 66 92L88 94M40 90V65Q50 50 61 65V91M46 67Q52 61 55 66V89')+detail(p('M34 47Q44 51 49 41M65 48L58 54M34 71L38 77M69 73L66 81'))+e(54,78,1.4)+leaf(75,24,44,.7),37,47);
define('tentacle-grimoire',book()+p('M53 47C33 35 39 10 55 11C70 12 66 31 55 25M60 48C77 41 88 47 82 59M47 48C26 34 19 48 26 55')+detail(dots([[48,19],[46,26],[50,33]],1.2))+star(73,57,6),46,43);
define('book-stack',stack()+p('M15 45Q48 35 81 43L83 62Q47 54 17 65Q9 56 15 45ZM18 50Q47 42 76 48M63 42V60L69 66L74 62V44')+leaf(29,38,-25,.7)+detail(p('M24 55L49 52M25 60L45 57')),42,34);
const idol=()=>p('M30 44C24 5 74 5 70 44M31 29Q20 19 13 34L13 62L28 51M70 30Q83 17 88 34L87 61L73 51M37 41C23 58 29 71 40 65C47 61 35 54 41 47M47 43C37 66 48 78 56 66M55 43C52 61 65 75 70 64C74 55 61 54 61 46M30 73H73L80 87H22ZM29 79H73')+e(40,33,4,2.5)+e(59,33,4,2.5)+detail(p('M18 39L26 45M17 48L24 49M83 39L76 45M83 48L77 50M36 81Q42 75 48 81Q55 86 63 80'));
define('cthulhu-statuette',idol()+p('M18 91H84M29 88L28 93M72 88L74 93'),41,45);
define('idol-on-books',stack()+group(idol(),'translate(12 -3) scale(.76)')+detail(p('M22 83L63 80')),43,47);
define('quill-and-ink',p('M41 71L66 21C72 7 90 3 91 9C91 36 71 61 53 61M43 69Q63 45 80 19M54 55L57 33M62 45L67 20M65 41L82 35M74 27L86 22M35 69H60V77Q72 81 68 92H26Q23 82 35 77ZM37 70V64H58V70M30 86H65')+detail(p('M43 85Q47 79 52 85Q47 91 43 85')),37,47);
define('hourglass',p('M23 8H78V17H23ZM27 17C26 36 37 42 45 49C34 58 26 65 28 83M73 17C74 36 63 42 55 49C66 58 74 65 72 83M22 84H79V94H22ZM18 18V82M83 18V82M35 26Q50 35 65 26M35 77L50 63L65 77Z')+detail(p('M50 39V54M50 58V60M27 12H74M27 89H74')),36,46);
define('wax-seal',e(49,44,29)+p('M25 64L19 93L35 85L43 95L48 73M55 73L64 95L73 83L86 88L73 61')+e(49,44,21)+star(49,44,14)+detail(p('M23 31L18 27M20 45H12M27 18L25 10M48 13V7M75 22L82 16M80 40L89 38')),42,46);
define('scholar-spectacles',e(27,55,20,18)+e(76,55,20,18)+p('M47 53Q51 46 56 53M7 52L10 35Q11 28 19 29M95 52L94 35Q94 28 86 29')+detail(p('M14 48Q18 42 24 43M63 48Q68 41 74 43M30 73L28 82M73 73L76 82')),48,30);
define('celestial-scroll',p('M21 15Q51 8 83 16L78 81Q87 82 86 89Q83 97 71 91L20 85Q9 83 13 76L20 22Q7 23 8 15Q13 5 21 15ZM20 22Q50 15 80 22M20 78Q44 75 71 83Q67 89 72 91')+e(49,49,19)+p('M58 32C41 36 40 55 53 65M36 38L50 47L63 41L56 61')+detail(dots([[36,38],[50,47],[63,41],[56,61]],1.8))+star(68,30,3),41,46);
define('hooded-scholar',p('M26 43C21 14 44 2 51 6C65 7 82 25 76 43L87 83L77 92L65 86L53 95L38 87L23 94L12 84ZM27 41Q49 12 75 42M34 39Q51 21 68 40Q50 49 34 39M30 46L18 77M72 46L84 77M36 57L48 64L42 78L26 69M51 62L77 54L79 73L53 83Z')+detail(p('M31 78L28 88M59 86L57 69M69 80L72 87M60 63L72 60M59 69L73 65')),40,47);
define('eye-locket',p('M39 22C24 11 39 1 49 9C60-1 76 11 61 22M36 24Q50 18 64 25L77 63Q71 83 50 94Q28 83 23 63ZM32 57Q50 35 69 57Q51 76 32 57Z')+e(50,57,8,11)+e(50,57,3)+detail(p('M30 68L27 73M70 68L74 73M38 84L35 87M61 84L65 87M45 24L48 34M56 24L53 34'))+e(50,12,3),31,47);
define('barnacled-shrine',p('M18 86V37L50 7L83 37V86ZM28 84V43L50 22L73 43V84M14 88H87V95H14M39 81V58Q50 41 63 58V81')+e(51,62,7,10)+p('M47 71Q35 80 40 88M53 72Q66 83 59 89')+detail(p('M21 42L27 45M74 45L81 42M35 25L39 31M62 27L58 33')+e(25,75,3)+e(75,60,4)+e(68,83,2)),40,47);
define('ritual-chalice',p('M23 20H78C78 48 65 60 52 61C35 60 23 48 23 20ZM49 61V81M54 61V81M37 83H66L76 93H26ZM25 28H76M23 33C2 21 6 58 30 52M77 33C98 21 94 58 71 52')+e(50,43,9,12)+p('M43 43Q50 34 57 43Q50 52 43 43')+detail(p('M37 24V30M63 24V30M30 89H71')),46,41);
define('incense-censer',p('M50 6L20 60M50 6L80 60M50 6V58M16 60H85Q81 84 52 88Q21 85 16 60ZM20 69Q50 80 80 69M43 89V95H60V89M37 50C24 38 54 30 43 19M61 51C48 38 73 28 63 16')+e(50,6,3)+detail(p('M28 77L31 82M39 82L41 86M65 81L62 86')),39,48);
define('telescope',p('M11 30L77 13L83 29L16 47ZM6 29L13 27L20 48L12 51ZM77 10L88 7L95 29L84 33ZM40 41L49 52H62L65 33M54 53V85M50 54L31 91M59 54L80 90M46 85H64')+detail(p('M21 32L25 44M67 18L72 32M30 32L64 23')),47,44);
define('watchtower',p('M27 46H73V75H27ZM21 45L50 24L80 45ZM32 75L23 97M68 75L77 97M33 76L68 95M67 76L31 95M24 96H76M35 48V65H65V48M44 49V62M56 49V62')+p('M13 70V20M1 46L13 21L25 46M5 57L13 39L22 57M83 76V18M71 47L83 19L96 47M75 59L83 39L92 59')+star(49,13,5),48,46);
define('moonlit-mountains',p('M4 83L31 28L53 72M30 28L41 52L47 47L70 15L96 84M60 35L68 41L73 31L82 46M20 51L28 57L35 46M7 86Q25 78 41 85Q59 95 73 85Q85 79 96 86')+p('M27 12C7 8 4 31 20 35C12 24 15 16 27 12Z')+star(49,23,4)+star(87,9,3),48,41);
define('owl-astrolabe',p('M29 24L23 8L42 16Q50 12 59 16L77 8L71 26Q84 58 65 76L35 76Q17 59 29 24ZM27 42Q36 66 46 72M73 42Q65 66 54 72M46 41L50 48L54 41M36 76L33 84M42 76L41 84M58 76L59 84M64 76L67 84')+e(38,33,11,13)+e(63,33,11,13)+dots([[38,33],[63,33]],2)+e(51,87,28,8)+detail(p('M32 51L37 56M37 58L42 63M68 51L63 56M63 58L58 63M47 56L50 60L54 56')),33,46);
define('coral-chest',p('M16 48C16 14 85 14 85 48V83Q50 94 16 83ZM16 48Q50 59 85 48M24 43C25 25 75 25 78 43M26 51V86M75 51V86M45 56H58V74H45Z')+e(51,64,2)+p('M46 47C25 35 34 16 48 18C57 21 53 33 46 28M60 46C73 31 88 35 83 45')+sprig(15,90,-25,.65)+detail(p('M32 62H43M60 63L69 61M31 76Q49 82 70 76')),43,42);
define('nautical-sextant',p('M18 83L57 12L92 81Q54 103 18 83ZM29 80L58 28L80 79Q54 91 29 80M51 28L81 18L84 27L55 39M56 15L64 12L67 21')+detail([25,35,45,55,65,75,85].map((x,i)=>l(x,85+Math.sin(i/6*Math.PI)*6,x+1,81+Math.sin(i/6*Math.PI)*6)).join(''))+e(56,45,4),42,46);
define('fern-cabinet',p('M16 91V24C16 0 84 0 84 24V91ZM21 30H79M21 58H79M21 84H79M48 31V84')+group(shell(0,0,.43),'translate(35 47)')+p('M59 52V40L65 35L72 40V52ZM60 70Q55 61 67 62Q78 63 73 72L76 80H58Z')+sprig(34,81,0,.43)+detail(p('M25 26Q50 13 75 26M19 94H81')),40,47);
define('raven-key',p('M31 55C15 45 20 19 40 15Q56 9 63 25L77 30L63 35Q65 54 53 63L70 79L53 77L42 68L32 77L37 60M29 30C23 44 36 57 45 52Q49 40 40 31M42 66L42 80M50 65L51 80')+e(51,26,2)+p('M12 82H76V89H72V94H65V89H61V94H55V88H12')+e(10,85,9,7)+detail(p('M28 38L36 43M29 45L37 49M38 20L42 19')),43,43);
define('sea-serpent',p('M19 78C12 49 52 47 67 70C83 96 98 76 90 64C84 55 73 64 80 70M27 81C20 59 46 56 59 75C86 112 111 72 93 56M19 58C9 33 22 10 41 13L52 6L54 19L69 26L52 34L44 31Q26 36 29 55M33 17L29 8M39 16L39 8')+e(43,23,2)+detail(p('M22 31Q28 26 35 27M30 50L37 48M43 53L47 49M54 58L59 54M64 67L70 63M73 80L76 75')),46,46);
define('stone-calendar',e(50,50,41)+e(50,50,33)+e(50,50,20)+p('M37 50Q50 35 63 50Q50 65 37 50Z')+e(50,50,6)+detail(Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return l(50+35*Math.cos(a),50+35*Math.sin(a),50+39*Math.cos(a),50+39*Math.sin(a));}).join(''))+detail(p('M32 25L35 28L31 31M65 25L69 28L66 32M24 65L28 61L31 65M66 72L70 67L74 70')),45,45);
define('astral-door',p('M18 93V39C18 1 83 1 83 39V93ZM28 91V40C28 15 73 15 73 40V91M14 96H88M50 26V91M31 64Q51 56 69 64')+e(61,68,2)+star(49,46,9)+detail(p('M21 42H27M21 60H27M74 43H80M74 60H80M28 24L33 28M70 24L65 28M44 12L45 20M59 12L58 20'))+sprig(16,94,-15,.65),42,48);
define('crystal-candle',p('M32 82V35Q41 26 51 35Q63 26 70 35V82M32 35Q33 57 41 42Q45 35 48 51Q53 59 57 42Q61 32 64 43Q69 49 70 36M43 25C30 9 50 2 50 0C51 9 70 17 57 26M26 84Q50 75 77 84V92Q50 97 26 92Z')+p('M16 83L7 60L17 46L29 64L26 84M8 60L18 63L17 46M18 63L21 83')+detail(p('M36 66V76M63 58V77')),41,49);
define('sealed-letter',p('M11 29L52 9L91 29V83H11ZM11 29L52 59L91 29M11 83L39 51M91 83L65 51')+e(52,59,12)+star(52,59,6)+detail(p('M30 23L50 15M77 76L84 76M78 71L84 71'))+leaf(21,90,-25,.5),45,40);
define('lighthouse',p('M32 88L39 36H63L72 88M33 36V25L51 12L70 25V36ZM40 25H62M45 25V35M57 25V35M29 91H76M43 49H60M40 64H64M38 79H67')+p('M16 92Q26 82 37 92Q48 102 59 92Q72 83 84 91M22 24L7 16M21 31L4 31M79 24L94 16M80 31L97 31')+detail(p('M47 88V81Q53 73 59 81V88')),48,44);
define('crystal-key',p('M43 36L32 17L47 1L64 17L54 37V91H45V79H34V70H45V62H37V54H45V37M32 17L48 23L47 1M48 23L54 37M64 17L48 23')+leaf(56,70,58,.7)+detail(p('M48 40H52M48 85H51')),30,48);
define('moth-star-chart',p('M46 40C25 11 1 15 10 39Q14 55 38 56C14 62 24 85 44 72M55 40C77 11 99 15 91 39Q87 55 63 56C86 62 77 85 57 72M47 36Q51 29 54 36L56 68Q51 82 46 68ZM48 35Q40 22 35 28M53 35Q62 22 67 28')+detail(p('M17 32L28 42L39 36L36 49M63 36L74 42L85 32M67 48L74 42')+dots([[17,32],[28,42],[39,36],[36,49],[63,36],[74,42],[85,32],[67,48]],1.4))+star(32,64,5)+star(72,64,5),46,39);
define('sailing-ammonite',shell(42,66,1.2)+p('M42 44V4M40 8L11 37Q26 43 40 35ZM46 9Q62 16 68 38Q54 45 46 38ZM57 73C76 63 92 70 84 78M56 80C76 75 88 86 75 89')+detail(p('M23 35L39 17M51 17Q59 24 60 35')),43,47);
define('curiosity-orb',p('M25 75L31 63C10 26 33 4 53 7C78 6 96 33 74 63L80 75ZM25 75Q51 85 80 75M38 81L33 93H73L68 81')+e(51,39,25)+p('M33 38Q50 18 69 38Q50 60 33 38Z')+e(51,38,7)+detail(p('M20 91H84M50 13V20M29 21L35 26M74 23L68 28')),39,47);
define('river-coral-vase',p('M35 41Q26 62 31 84Q49 98 70 84Q76 62 66 41ZM33 41H68V34H33ZM40 33C22 19 37 6 48 15Q53 24 44 26M57 34C73 24 87 30 84 15M56 33C48 16 56 5 65 2')+sprig(45,31,-10,.5)+detail(p('M34 56Q50 65 69 56M34 73Q50 81 69 73')),36,49);
define('mushroom-door',p('M10 47C15 2 82 0 91 47Q50 37 10 47ZM29 44Q24 66 30 91Q49 99 70 91Q76 69 70 44M40 92V70Q50 56 60 70V92M14 45Q51 56 86 45')+e(36,25,5,3)+e(64,22,4,3)+e(55,35,3,2)+e(54,80,1.3)+sprig(21,94,-25,.6),46,47);
define('candle-crab',p('M27 64C29 47 71 47 75 64Q67 83 49 81Q31 82 27 64M27 61L15 51L6 57L9 43M74 61L85 51L94 57L91 43M30 74L15 77L8 89M39 80L28 88L27 97M69 74L85 77L93 89M61 80L72 88L73 97M42 54V24H59V54M41 24Q45 32 49 24Q54 35 60 24M48 17C37 7 54 1 52 0Q66 10 56 17')+e(37,60,2)+e(66,60,2),47,48);
define('winged-key',e(49,27,13,16)+e(49,27,6,8)+p('M45 44V94H55V83H67V75H55V64H63V57H55V44M36 32C7 8-4 39 31 47C5 50 15 73 43 54M63 32C94 8 105 39 69 47C95 50 86 73 57 54')+detail(p('M13 29L32 40M14 59L35 51M87 29L68 40M86 59L65 51')),47,47);
define('pearl-eye',p('M9 65C3 36 20 21 41 31C50 6 78 17 79 37Q103 42 92 65L69 90H32ZM9 65Q49 49 92 65M18 69L38 84M32 63L44 84M83 70L64 85M68 63L57 84')+e(51,49,17)+p('M39 49Q51 38 63 49Q51 59 39 49Z')+e(51,49,4),47,42);
define('star-pocketwatch',e(50,54,33)+e(50,54,26)+e(50,12,7)+p('M39 22V17H61V22M50 28V34M50 74V80M24 54H30M70 54H76M50 54L41 38M50 54L66 46M18 25C-4 26 1 67 18 75')+star(50,54,6)+detail(p('M31 35L35 39M69 35L65 39M31 73L35 69M69 73L65 69')),43,47);
define('relic-tablet',p('M25 9L76 14L84 82L72 94L21 87L16 24ZM24 18L68 22L76 80L67 85L28 79Z')+detail(p('M36 30H58M34 40L42 34L50 41L58 35M35 50L42 57L49 50L59 58M38 66H57M33 23L38 27M67 71L71 74'))+sprig(18,92,-20,.6),38,46);
define('closed-eye-tome',p('M23 10L77 16L85 88L29 94Q17 90 18 79V22Q17 13 23 10ZM23 17L71 23L78 81L29 87M30 23L35 80M39 50Q54 33 71 50Q54 67 39 50Z')+e(54,50,6)+p('M77 42H88V61H80M25 89L81 84')+detail(p('M42 28L55 31M45 75L64 77M45 40L42 35M65 40L68 35')),37,46);
define('archaeologist-trowel',p('M40 29V10Q49 1 59 10V29ZM43 29V44H56V29M43 44L27 67L49 96L73 67L56 44ZM49 48V86M32 66L48 84L66 67')+detail(p('M45 12V25M34 69L42 74'))+leaf(77,77,47,.7),35,47);

/* Small, directly drawn details fill the irregular spaces without a dot-grid. */
const fillers=[
 {id:'spark',body:star(0,0,8),r:9},
 {id:'crescent',body:p('M5-9C-12-12-15 9 2 11C-7 4-5-4 5-9Z'),r:12},
 {id:'seed',body:e(0,0,5,9)+p('M0 8Q-3 0 0-7'),r:10},
 {id:'leaflet',body:leaf(0,10,15,.65),r:12},
 {id:'shelllet',body:p('M-10 5Q-9-9 0-10Q10-9 11 5ZM-7 4L-3-6M0 4V-7M7 4L3-6M-6 8H7'),r:13},
 {id:'spores',body:e(-5,-5,2)+e(5,4,2)+e(-6,8,1.2)+e(7,-7,1),r:11},
 {id:'ripple',body:p('M-12 2Q-5-5 2 2Q9 9 15 2M-8 8Q-1 2 6 8'),r:16},
 {id:'tiny-eye',body:p('M-13 0Q0-12 13 0Q0 12-13 0Z')+e(0,0,4),r:14},
 {id:'coral-sprout',body:p('M0 13C-3 3 4-3 0-14M0 4Q-11 2-10-7M1-2Q11-4 10-11'),r:15},
 {id:'curl',body:p('M-9 10C-18-9 9-17 12-2C14 10-8 11-5 0Q-3-6 3-3'),r:16},
 {id:'little-mushroom',body:mushroom(0,-1,.48),r:13},
 {id:'small-comet',body:e(-5,5,4)+p('M-6-1L7-12M-1 5L13-8M-1 1L10-10'),r:16},
 {id:'fern-tip',body:sprig(0,15,-5,.62),r:18},
 {id:'constellation',body:p('M-11 7L-3-7L11-2L6 11')+dots([[-11,7],[-3,-7],[11,-2],[6,11]],1.7),r:16}
];

let seed=0x4188ccab;
const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
const placements=[];
const shuffle=items=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
// Distance is toroidal: edge details continue by translation, never reflection or inversion.
const distance=(a,b,size)=>Math.min(Math.abs(a-b),size-Math.abs(a-b));
const order=[...shuffle(motifs),...shuffle(motifs).slice(0,96-motifs.length)]
 .map(motif=>{const s=1.18+random()*.45;return {...motif,s,rx:motif.rx*s+5,ry:motif.ry*s+5};})
 .sort((a,b)=>b.rx*b.ry-a.rx*a.ry);
// Uneven spacing and varied sizes avoid visible rows. All large motifs have distinct silhouettes.
for(const motif of order){
 let chosen=null,best=-1;
 for(let fit=0;fit<9;fit++){
  best=-1;
  for(let attempt=0;attempt<2400;attempt++){
   const candidate={...motif,x:random()*W,y:random()*H,a:(random()-.5)*28};
   let clearance=10;
   for(const other of placements){
    const dx=distance(candidate.x,other.x,W),dy=distance(candidate.y,other.y,H);
    clearance=Math.min(clearance,Math.hypot(dx/(candidate.rx+other.rx+5),dy/(candidate.ry+other.ry+5)));
   }
   if(clearance>best){chosen=candidate;best=clearance;}
  }
  if(best>=1)break;
  motif.s*=.94;motif.rx*=.94;motif.ry*=.94;
 }
 if(best<1)throw new Error(`Illustration ${placements.length}, clearance ${best}`);
 placements.push(chosen);
}
const small=[];
for(let attempt=0;attempt<42000&&small.length<620;attempt++){
 const item=fillers[Math.floor(random()*fillers.length)],s=attempt<11000?1.35+random()*.55:.7+random()*.6;
 const x=random()*W,y=random()*H,r=item.r*s;
 if(placements.some(main=>{
   const dx=distance(x,main.x,W),dy=distance(y,main.y,H);
   return (dx/(main.rx+r+3))**2+(dy/(main.ry+r+3))**2<1;
 }))continue;
 if(small.some(other=>Math.hypot(distance(x,other.x,W),distance(y,other.y,H))<r+other.r+4))continue;
 small.push({id:item.id,x,y,s,a:(random()-.5)*40,r});
}

const place=(item,center=50)=>{
 const pad=center===50?105:35,parts=[];
 for(const dx of [-W,0,W])for(const dy of [-H,0,H]){
  const x=item.x+dx,y=item.y+dy;
  if(x+pad*item.s<0||x-pad*item.s>W||y+pad*item.s<0||y-pad*item.s>H)continue;
  parts.push(`<use href="#${item.id}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${item.a.toFixed(2)}) scale(${item.s.toFixed(3)})${center?` translate(-${center} -${center})`:''}"/>`);
 }
 return parts.join('\n');
};
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke="#53656b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">
<title>Occult explorer’s field journal — smooth vector edition</title>
<desc>Original directly authored vector curves: ${motifs.length} distinct illustrations, ${placements.length} upright placements and ${small.length} small botanical, nautical and celestial details. Edges join with translated continuations, without mirrored or inverted artwork. No bitmap or traced contours.</desc>
<defs>
${motifs.map(m=>`<g id="${m.id}">${m.body}</g>`).join('\n')}
${fillers.map(f=>`<g id="${f.id}" stroke-width="1.4">${f.body}</g>`).join('\n')}
</defs>
<g opacity=".24">
${placements.map(item=>place(item)).join('\n')}
${small.map(item=>place(item,0)).join('\n')}
</g>
</svg>\n`;
const target=new URL('../next/assets/occult-field-journal-v2.svg',import.meta.url);
writeFileSync(target,svg);
console.log(JSON.stringify({file:target.pathname,distinctIllustrations:motifs.length,illustrations:placements.length,details:small.length,bytes:Buffer.byteLength(svg)}));
