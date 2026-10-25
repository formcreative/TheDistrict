// Logical canvas size. The world is authored in these units and scaled to fit the screen.
export const W = 400;
export const H = 820;

// Economy — tune pacing here. Target: first café purchase after ~25–40s of swiping.
export const CAFE_PRICE = 100;
export const GRASS = {
  spacing: 21,       // grid spacing between tufts
  cutRadius: 18,     // how close a swipe must pass to cut a tuft
  regrowDelay: 9,    // seconds before a cut tuft grows back (as healthy lawn)
  coinValue: 1,
  weedChance: 0.08,  // weedy tufts with a flower pop bonus coins the first time
  weedCoins: 2,
};

export const LAYOUT = {
  buildingBase: 430,
  yardTop: 444,
  yardBottom: 590,
  pathX0: 178,
  pathX1: 222,
  sidewalkTop: 590,
  curbTop: 638,
  roadTop: 650,
  roadBottom: 740,
  vergeTop: 748,
  hedgeTop: 822,
  walkY: 616,
  doorX: 200,
  doorY: 438,
};

export const LAWNS = [
  { x: 0, y: 446, w: 178, h: 142 },   // left front yard
  { x: 222, y: 446, w: 178, h: 142 }, // right front yard
  { x: 0, y: 752, w: 400, h: 66 },    // verge across the road
];
