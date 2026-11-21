import { artPicture, classArt, loadArt, CLASS_ART } from './art.js';
import { pixelCanvas, pixelPainter } from './pirate.js';

export const WARDROBE = {
  hat: [['tricorn','Tricorn'], ['captain','Captain hat'], ['bandana','Bandana'], ['beanie','Beanie'], ['crown','Crown'], ['trav','Captain Trav hat']],
  eyes: [['amber','Amber shades'], ['patch','Eyepatch'], ['goggles','Goggles'], ['teal','Teal shades'], ['visor','Visor']],
  coat: [['hoodie','Hoodie'], ['trench','Two-tone coat'], ['vest','Vest'], ['captain','Captain coat'], ['sonar','Sonar jacket']],
  item: [['laptop','Laptop'], ['cutlass','Cutlass'], ['spyglass','Spyglass'], ['flask','Coffee flask'], ['map','Treasure map']]
};

export const TRAV_HAT = WARDROBE.hat.length - 1;

const gameClasses = Object.keys(CLASS_ART);
const defaults = {
  hacker: {hat:2, eyes:0, coat:2, item:0},
  builder: {hat:1, eyes:2, coat:4, item:2},
  connector: {hat:0, eyes:3, coat:1, item:4},
  investor: {hat:4, eyes:1, coat:3, item:3}
};

export function normalizeLook(value) {
  return Object.fromEntries(Object.entries(WARDROBE).map(([key, options]) => {
    const index = value?.[key];
    return [key, Number.isInteger(index) && options[index] ? index : -1];
  }));
}

export function rollLook(random = Math.random) {
  return Object.fromEntries(Object.entries(WARDROBE).map(([key, options]) => [key, Math.floor(random() * (key === 'hat' ? TRAV_HAT : options.length))]));
}

export function partArt(group, index) {
  const option = WARDROBE[group]?.[index];
  return option ? group + '-' + option[0] : null;
}

const colors = {
  hacker: ['#37df95','#149f7b','#70f9d2','#18866e'],
  builder: ['#43ceff','#1477b4','#fff19a','#235988'],
  connector: ['#ff5a5a','#9b2954','#ff9972','#9c3956'],
  investor: ['#fff5d6','#a99aa0','#fffadf','#716885']
};

const placements = {
  hat: [27, 5, 84, 42],
  eyes: [41, 37, 52, 23],
  coat: [33, 66, 73, 60],
  item: [4, 83, 53, 49]
};

function paintBody(ctx, type, shade = 0) {
  ctx.clearRect(0,0,132,144);
  const { box, poly } = pixelPainter(ctx);
  const [feathers, shadow, cheek, tail] = colors[type] || colors.hacker;
  const ink = '#08101e';
  const brown = '#8a582f';
  const gold = shade % 2 ? '#e4aa58' : '#ffc66b';
  box('#06121fb5', 24, 136, 87, 5);
  poly(ink, [[37,86],[42,75],[47,68],[45,47],[38,38],[44,27],[55,21],[70,21],[83,24],[95,38],[98,52],[91,66],[84,74],[92,79],[101,97],[123,116],[119,126],[101,124],[98,134],[87,138],[69,137],[65,129],[54,128],[51,135],[27,138],[25,130],[31,121],[28,105]]);
  poly(tail, [[82,88],[92,94],[104,106],[117,116],[114,122],[97,119],[78,104]]);
  poly(shadow, [[40,83],[48,76],[81,76],[91,85],[96,105],[87,119],[81,128],[51,127],[41,117],[31,107]]);
  poly(feathers, [[44,79],[66,75],[85,83],[90,100],[84,111],[69,123],[45,120],[39,107]]);
  poly(feathers, [[44,43],[49,30],[59,24],[72,24],[85,29],[92,40],[94,54],[86,66],[78,76],[61,78],[48,72],[42,62]]);
  poly(cheek, [[44,40],[52,31],[67,31],[74,36],[72,50],[65,58],[53,60],[44,53]]);
  poly(ink, [[50,44],[48,39],[39,40],[29,45],[26,54],[26,63],[30,70],[37,68],[42,60],[51,58],[55,50]]);
  poly(gold, [[50,44],[38,42],[31,47],[28,55],[28,63],[31,66],[36,60],[38,54],[47,54]]);
  box(brown,34,62,5,4); box('#ffe6a0',35,47,8,2);
  box(ink,60,39,6,9); box('#fff3d5',61,39,2,3);
  box(shadow,77,58,7,4); box(shadow,74,64,6,3); box(shadow,81,51,6,4);
  poly(ink,[[41,119],[52,119],[50,131],[44,137],[25,137],[25,130],[34,126]]);
  poly(gold,[[41,121],[49,121],[48,131],[43,134],[28,135],[28,132],[36,129]]);
  poly(ink,[[72,120],[84,119],[86,129],[96,132],[96,138],[74,138],[68,135]]);
  poly(gold,[[74,122],[82,121],[84,130],[92,133],[92,136],[74,136],[71,134]]);
  poly(ink,[[38,87],[51,89],[55,98],[50,104],[38,107],[30,103],[27,95],[31,88]]);
  poly(feathers,[[37,89],[48,91],[52,98],[47,102],[38,104],[31,101],[30,95]]);
  box(cheek,37,94,9,3);
  if (type === 'investor') poly(cheek, [[74,29],[83,26],[88,18],[91,24],[96,22],[95,33],[91,39]]);
}

function fit(ctx, img, [x, y, width, height]) {
  const scale = Math.min(width / img.width, height / img.height);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  ctx.drawImage(img, x + Math.round((width - w) / 2), y + Math.round((height - h) / 2), w, h);
}

export async function prepareDressed(type, value) {
  const look = normalizeLook(value);
  const base = defaults[type] || defaults.hacker;
  const custom = Object.values(look).some(index => index >= 0);
  if (!custom) {
    const art = await loadArt(classArt(type)).catch(() => null);
    return ctx => {
      ctx.clearRect(0,0,132,144);
      ctx.imageSmoothingEnabled = false;
      if (art) ctx.drawImage(art,0,0,132,144);
      else paintBody(ctx,type);
    };
  }
  const parts = await Promise.all(['coat','hat','eyes','item'].map(async group => {
    const index = look[group] < 0 ? base[group] : look[group];
    const art = await loadArt(partArt(group,index)).catch(() => null);
    return [group,art];
  }));
  return ctx => {
    ctx.imageSmoothingEnabled = false;
    paintBody(ctx,type,look.hat);
    for (const [group, art] of parts) if (art) fit(ctx,art,placements[group]);
  };
}

export function dressedSprite(type, look, className = 'crew-sprite dressed-crew') {
  if (!Object.values(normalizeLook(look)).some(index => index >= 0)) {
    return artPicture(classArt(type), {width:132,height:144,className});
  }
  const canvas = pixelCanvas(132, className);
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  paintBody(ctx,type);
  void prepareDressed(type,look).then(paint => paint(ctx));
  return canvas;
}

export function seededLook(person) {
  const source = person.pirate;
  const type = gameClasses[(source?.bird || 0) % gameClasses.length];
  const look = source ? {hat: source.hat, eyes: source.eye, coat: source.coat % 5, item: source.item} : null;
  return {type, look};
}
