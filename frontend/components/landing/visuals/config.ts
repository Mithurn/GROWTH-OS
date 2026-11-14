export const CLOCK = { stepMs: 50, visibleThreshold: 0.25 } as const;

export const OPPORTUNITY = {
  endMs: 9000,
  title: 'Win back 76 dormant VIPs',
  type: 'Dormant VIPs',
  revenue: { to: 1.1, fromMs: 400, toMs: 2200 },
  confidence: { to: 88, segments: 10, fromMs: 1200, toMs: 2600 },
  stats: [
    { label: 'Audience', value: '76' },
    { label: 'Avg order', value: '₹4,820' },
    { label: 'Predicted conversion', value: '14%' },
  ],
  action: 'Send a WhatsApp message with an early-access offer',
  button: 'Draft campaign',
  pressedLabel: 'Drafting',
  cursorMoveMs: 1400,
  cursorStops: [
    { atMs: 0, x: 88, y: 14 },
    { atMs: 3000, x: 84, y: 91 },
  ],
  pressMs: 5200,
  releaseMs: 7800,
} as const;

export const CAMPAIGN = {
  endMs: 9000,
  before: 'Hi Aarav, the festive collection is here, and you get first look before it opens to everyone. Reserve your favourites today and we will gift wrap them for free.',
  after: 'Aarav, early access to the festive collection closes tonight. Reserve your favourites now, gift wrap is on us.',
  instruction: 'Shorter and more urgent',
  chips: [
    { label: 'Shorter', onMs: 1400 },
    { label: 'More urgent', onMs: 2000 },
    { label: 'More premium', onMs: Infinity },
  ],
  typeFromMs: 2400,
  typeCharMs: 55,
  sendMs: 4400,
  streamFromMs: 4900,
  streamCharMs: 30,
  channel: 'WhatsApp',
  time: '10:42',
} as const;

export const FUNNEL = {
  endMs: 4000,
  firstMs: 300,
  rowStaggerMs: 450,
  rowRiseMs: 1800,
  rows: [
    { label: 'Sent', value: 189 },
    { label: 'Delivered', value: 178 },
    { label: 'Read', value: 131 },
    { label: 'Clicked', value: 47 },
  ],
  footer: [
    { label: 'Delivery rate', value: '94%' },
    { label: 'Click rate', value: '26%' },
    { label: 'Failed', value: '11' },
  ],
} as const;

export const PERSONAS = {
  stepMs: 1800,
  endMs: 5400,
  selection: [0, 1, 3],
  rows: [
    { name: 'Loyal Trendsetters', note: 'Buy new arrivals within a week of launch', customers: 184, spend: '₹6,739', share: 34, days: 21 },
    { name: 'Seasonal Splurgers', note: 'Large baskets around festivals', customers: 267, spend: '₹3,670', share: 27, days: 64 },
    { name: 'Steady Regulars', note: 'Reliable monthly buyers', customers: 412, spend: '₹2,087', share: 24, days: 33 },
    { name: 'Style Builders', note: 'Complete outfits rather than single items', customers: 231, spend: '₹1,558', share: 10, days: 78 },
    { name: 'Curious Browsers', note: 'Tried you once, price sensitive', customers: 386, spend: '₹466', share: 5, days: 142 },
  ],
} as const;
