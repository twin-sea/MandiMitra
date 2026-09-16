require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
// Render (and most hosts) assign their own port via the PORT environment
// variable - falling back to 4000 keeps local development working exactly
// as before.
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());

const BOOKING_STATUSES = ['CONFIRMED', 'ARRIVED', 'GRADED', 'PAYMENT_INITIATED', 'PAID', 'CANCELLED'];
const GRIEVANCE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

function generateBookingToken() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MM-${year}-${random}`;
}

function generateTicketNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `GR-${year}-${random}`;
}

async function fetchLiveWeather(mandi) {
  if (mandi.latitude == null || mandi.longitude == null) {
    return { error: 'This mandi has no location coordinates saved yet' };
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${mandi.latitude}&lon=${mandi.longitude}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=metric`;
  const weatherRes = await fetch(url);
  const weatherData = await weatherRes.json();

  if (!weatherRes.ok) {
    return { error: 'Weather service error', details: weatherData };
  }

  return {
    mandi: mandi.nameEn,
    temperatureCelsius: weatherData.main.temp,
    feelsLikeCelsius: weatherData.main.feels_like,
    humidityPercent: weatherData.main.humidity,
    windSpeedMetersPerSecond: weatherData.wind.speed,
    condition: weatherData.weather[0].main,
    conditionDescription: weatherData.weather[0].description,
  };
}

async function fetchLivePrice(crop, mandi) {
  const params = new URLSearchParams({
    'api-key': process.env.DATA_GOV_IN_API_KEY,
    format: 'json',
    limit: '10',
    'filters[commodity]': crop.nameEn,
    'filters[state.keyword]': mandi.state,
    'filters[district]': mandi.district,
  });

  const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${params.toString()}`;
  const priceRes = await fetch(url);
  const priceData = await priceRes.json();

  if (!priceRes.ok) {
    return { error: 'Price service error', details: priceData };
  }

  if (!priceData.records || priceData.records.length === 0) {
    return {
      error: 'No live price records reported for this crop/district combination right now',
      crop: crop.nameEn,
      district: mandi.district,
      state: mandi.state,
    };
  }

  const latest = priceData.records[0];

  return {
    crop: crop.nameEn,
    mandi: mandi.nameEn,
    market: latest.market,
    variety: latest.variety,
    arrivalDate: latest.arrival_date,
    minPriceRsPerQuintal: Number(latest.min_price),
    maxPriceRsPerQuintal: Number(latest.max_price),
    modalPriceRsPerQuintal: Number(latest.modal_price),
    mspPerQuintal: crop.mspPerQuintal,
  };
}

// data.gov.in reports arrival_date as DD/MM/YYYY - this turns that into a
// sortable number so real dates can be ordered chronologically.
function parseArrivalDate(d) {
  const [day, month, year] = (d || '').split('/').map(Number);
  if (!day || !month || !year) return 0;
  return year * 10000 + month * 100 + day;
}

// Real day-by-day price points for a crop at a mandi, straight from the
// same government feed fetchLivePrice uses - just asking for more records
// and grouping them by the real arrival_date instead of taking only the
// latest one. The government feed only keeps a short rolling window of
// recent days (not a long archive), so this may come back with very few
// distinct dates - the caller shows that honestly instead of drawing a
// trend line out of a single real point.
async function fetchPriceHistory(crop, mandi) {
  const params = new URLSearchParams({
    'api-key': process.env.DATA_GOV_IN_API_KEY,
    format: 'json',
    limit: '100',
    'filters[commodity]': crop.nameEn,
    'filters[state.keyword]': mandi.state,
    'filters[district]': mandi.district,
  });

  const url = `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?${params.toString()}`;
  const priceRes = await fetch(url);
  const priceData = await priceRes.json();

  if (!priceRes.ok) {
    return { error: 'Price service error', details: priceData };
  }

  if (!priceData.records || priceData.records.length === 0) {
    return {
      error: 'No live price records reported for this crop/district combination right now',
      crop: crop.nameEn,
      district: mandi.district,
      state: mandi.state,
    };
  }

  const byDate = new Map();
  for (const record of priceData.records) {
    const date = record.arrival_date;
    const modal = Number(record.modal_price);
    if (!date || Number.isNaN(modal)) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(modal);
  }

  const points = Array.from(byDate.entries())
    .map(([date, prices]) => ({
      date,
      modalPriceRsPerQuintal: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    }))
    .sort((a, b) => parseArrivalDate(a.date) - parseArrivalDate(b.date));

  return {
    crop: crop.nameEn,
    mandi: mandi.nameEn,
    points,
  };
}

const CHATBOT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'createBooking',
        description:
          "Create a real mandi slot booking for the current farmer. Only call this AFTER the farmer has explicitly confirmed the crop, quantity, mandi, and date in their most recent message.",
        parameters: {
          type: 'object',
          properties: {
            cropId: { type: 'number', description: 'The id of the crop, from the crop list given in context.' },
            mandiId: { type: 'number', description: 'The id of the mandi, from the mandi list given in context.' },
            quantityQuintal: { type: 'number', description: 'Quantity in quintals.' },
            slotDate: { type: 'string', description: 'Date in YYYY-MM-DD format.' },
          },
          required: ['cropId', 'mandiId', 'quantityQuintal', 'slotDate'],
        },
      },
      {
        name: 'checkBookingStatus',
        description: "Check the real current procurement/payment status of one of the farmer's bookings.",
        parameters: {
          type: 'object',
          properties: {
            bookingId: { type: 'number', description: 'The booking id.' },
          },
          required: ['bookingId'],
        },
      },
      {
        name: 'checkQueueStatus',
        description: "Check the farmer's real live queue position for a booking that is still waiting.",
        parameters: {
          type: 'object',
          properties: {
            bookingId: { type: 'number', description: 'The booking id.' },
          },
          required: ['bookingId'],
        },
      },
      {
        name: 'fileGrievance',
        description: 'File a real grievance/complaint for the current farmer and get back a real ticket number.',
        parameters: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Short subject line.' },
            description: { type: 'string', description: 'Full description of the complaint.' },
            bookingId: { type: 'number', description: 'Optional related booking id.' },
          },
          required: ['subject', 'description'],
        },
      },
      {
        name: 'checkGrievanceStatus',
        description: 'Check the real current status of a previously filed grievance by its ticket number.',
        parameters: {
          type: 'object',
          properties: {
            ticketNumber: { type: 'string', description: 'The grievance ticket number, e.g. GR-2026-1234.' },
          },
          required: ['ticketNumber'],
        },
      },
      {
        name: 'getCropPrice',
        description: 'Get the real live government-reported mandi price for a crop at a specific mandi.',
        parameters: {
          type: 'object',
          properties: {
            cropId: { type: 'number' },
            mandiId: { type: 'number' },
          },
          required: ['cropId', 'mandiId'],
        },
      },
      {
        name: 'getMandiWeather',
        description: 'Get the real live current weather at a specific mandi.',
        parameters: {
          type: 'object',
          properties: {
            mandiId: { type: 'number' },
          },
          required: ['mandiId'],
        },
      },
    ],
  },
];

async function runChatbotFunction(name, args, farmer) {
  try {
    if (name === 'createBooking') {
      const crop = await prisma.crop.findUnique({ where: { id: Number(args.cropId) } });
      const mandi = await prisma.mandi.findUnique({ where: { id: Number(args.mandiId) } });
      if (!crop || !mandi) return { error: 'Invalid crop or mandi id' };

      const booking = await prisma.booking.create({
        data: {
          tokenNumber: generateBookingToken(),
          farmerName: farmer.farmerName || 'Unknown',
          farmerPhone: farmer.farmerPhone,
          cropId: crop.id,
          mandiId: mandi.id,
          quantityQuintal: Number(args.quantityQuintal),
          slotDate: new Date(args.slotDate),
        },
        include: { crop: true, mandi: true },
      });

      return {
        success: true,
        bookingId: booking.id,
        tokenNumber: booking.tokenNumber,
        crop: booking.crop.nameEn,
        mandi: booking.mandi.nameEn,
        quantityQuintal: booking.quantityQuintal,
        slotDate: booking.slotDate.toDateString(),
        status: booking.status,
      };
    }

    if (name === 'checkBookingStatus') {
      const booking = await prisma.booking.findUnique({
        where: { id: Number(args.bookingId) },
        include: { crop: true, mandi: true },
      });
      if (!booking) return { error: 'Booking not found' };
      return {
        bookingId: booking.id,
        tokenNumber: booking.tokenNumber,
        crop: booking.crop.nameEn,
        mandi: booking.mandi.nameEn,
        status: booking.status,
      };
    }

    if (name === 'checkQueueStatus') {
      const booking = await prisma.booking.findUnique({ where: { id: Number(args.bookingId) } });
      if (!booking) return { error: 'Booking not found' };

      if (booking.status !== 'CONFIRMED') {
        return { status: booking.status, message: `Not waiting in queue anymore. Current status: ${booking.status}` };
      }

      const waiting = await prisma.booking.findMany({
        where: { mandiId: booking.mandiId, status: 'CONFIRMED' },
        orderBy: [{ slotDate: 'asc' }, { createdAt: 'asc' }],
      });
      const position = waiting.findIndex((b) => b.id === booking.id) + 1;

      return { positionInQueue: position, totalWaiting: waiting.length, farmersAhead: position - 1 };
    }

    if (name === 'fileGrievance') {
      const grievance = await prisma.grievance.create({
        data: {
          ticketNumber: generateTicketNumber(),
          farmerName: farmer.farmerName || 'Unknown',
          farmerPhone: farmer.farmerPhone,
          subject: args.subject,
          description: args.description,
          bookingId: args.bookingId ? Number(args.bookingId) : null,
        },
      });
      return { success: true, ticketNumber: grievance.ticketNumber, status: grievance.status };
    }

    if (name === 'checkGrievanceStatus') {
      const grievance = await prisma.grievance.findUnique({ where: { ticketNumber: args.ticketNumber } });
      if (!grievance) return { error: 'Grievance not found' };
      return { ticketNumber: grievance.ticketNumber, subject: grievance.subject, status: grievance.status };
    }

    if (name === 'getCropPrice') {
      const crop = await prisma.crop.findUnique({ where: { id: Number(args.cropId) } });
      const mandi = await prisma.mandi.findUnique({ where: { id: Number(args.mandiId) } });
      if (!crop || !mandi) return { error: 'Invalid crop or mandi id' };
      return await fetchLivePrice(crop, mandi);
    }

    if (name === 'getMandiWeather') {
      const mandi = await prisma.mandi.findUnique({ where: { id: Number(args.mandiId) } });
      if (!mandi) return { error: 'Invalid mandi id' };
      return await fetchLiveWeather(mandi);
    }

    return { error: `Unknown function: ${name}` };
  } catch (err) {
    return { error: 'Internal error running function', details: String(err) };
  }
}

function signToken(farmer) {
  return jwt.sign({ farmerId: farmer.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function toPublicFarmer(farmer) {
  const { passwordHash, ...rest } = farmer;
  return rest;
}

// Verifies the Authorization: Bearer <token> header and attaches the real,
// freshly-looked-up logged-in farmer to req.farmer for routes that need one.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const farmer = await prisma.farmer.findUnique({ where: { id: payload.farmerId } });
    if (!farmer) return res.status(401).json({ error: 'Account no longer exists' });
    req.farmer = farmer;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired login' });
  }
}

app.post('/auth/register', async (req, res) => {
  const { name, phone, password, state, district, preferredLanguage } = req.body;
  if (!name || !phone || !password || !state || !district) {
    return res.status(400).json({ error: 'name, phone, password, state, and district are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await prisma.farmer.findUnique({ where: { phone } });
  if (existing) {
    return res
      .status(409)
      .json({ error: 'An account with this phone number already exists. Try logging in instead.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const farmer = await prisma.farmer.create({
    data: { name, phone, passwordHash, state, district, preferredLanguage: preferredLanguage || 'hi' },
  });

  const token = signToken(farmer);
  res.status(201).json({ token, farmer: toPublicFarmer(farmer) });
});

app.post('/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'phone and password are required' });
  }

  const farmer = await prisma.farmer.findUnique({ where: { phone } });
  if (!farmer) {
    return res.status(401).json({ error: 'No account found with this phone number' });
  }

  const valid = await bcrypt.compare(password, farmer.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const token = signToken(farmer);
  res.json({ token, farmer: toPublicFarmer(farmer) });
});

app.get('/auth/me', requireAuth, async (req, res) => {
  res.json(toPublicFarmer(req.farmer));
});

app.put('/auth/me', requireAuth, async (req, res) => {
  const { name, state, district, preferredLanguage } = req.body;
  const updated = await prisma.farmer.update({
    where: { id: req.farmer.id },
    data: {
      ...(name !== undefined && { name }),
      ...(state !== undefined && { state }),
      ...(district !== undefined && { district }),
      ...(preferredLanguage !== undefined && { preferredLanguage }),
    },
  });
  res.json(toPublicFarmer(updated));
});

// Permanently removes the logged-in farmer's account and row from the real
// database. Bookings/grievances store the farmer's name+phone as plain text
// (not a foreign key to Farmer), so they intentionally stay as a real
// historical record after the account is gone, the same way they would at
// a real mandi office.
app.delete('/auth/me', requireAuth, async (req, res) => {
  await prisma.farmer.delete({ where: { id: req.farmer.id } });
  res.json({ success: true });
});

app.get('/', (req, res) => {
  res.send('MandiMitra backend is running!');
});

app.get('/crops', async (req, res) => {
  const crops = await prisma.crop.findMany();
  res.json(crops);
});

app.post('/crops', async (req, res) => {
  const { nameEn, nameHi, slug, mspPerQuintal } = req.body;
  const crop = await prisma.crop.create({
    data: { nameEn, nameHi, slug, mspPerQuintal },
  });
  res.status(201).json(crop);
});

app.get('/mandis', async (req, res) => {
  const { state, district } = req.query;
  const where = {};
  if (state) where.state = state;
  if (district) where.district = district;

  const mandis = await prisma.mandi.findMany({ where });

  const counts = await prisma.booking.groupBy({
    by: ['mandiId'],
    where: { status: 'CONFIRMED' },
    _count: { _all: true },
  });
  const countByMandi = Object.fromEntries(counts.map((c) => [c.mandiId, c._count._all]));

  res.json(mandis.map((m) => ({ ...m, farmersWaiting: countByMandi[m.id] || 0 })));
});

async function geocodeLocation(query) {
  const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=1&appid=${process.env.OPENWEATHERMAP_API_KEY}`;
  const geoRes = await fetch(url);
  const geoData = await geoRes.json();
  if (!geoRes.ok || !Array.isArray(geoData) || geoData.length === 0) return null;
  return { latitude: geoData[0].lat, longitude: geoData[0].lon };
}

// Bulk-add real mandis. Each entry only needs a real market name, district,
// and state (e.g. pulled from the government price dataset) - this route
// looks up each one's real coordinates via live geocoding rather than
// requiring lat/long to be typed in by hand, and skips anything already
// saved (matched by slug) so it's safe to re-run.
app.post('/mandis/bulk-import', async (req, res) => {
  const { mandis } = req.body;
  if (!Array.isArray(mandis)) {
    return res.status(400).json({ error: 'mandis must be an array' });
  }

  const results = [];
  for (const m of mandis) {
    try {
      const existing = await prisma.mandi.findUnique({ where: { slug: m.slug } });
      if (existing) {
        results.push({ slug: m.slug, status: 'already exists', id: existing.id });
        continue;
      }

      const geo = await geocodeLocation(`${m.district},${m.state},IN`);
      const created = await prisma.mandi.create({
        data: {
          nameEn: m.nameEn,
          nameHi: m.nameHi || m.nameEn,
          slug: m.slug,
          district: m.district,
          state: m.state,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
        },
      });
      results.push({
        slug: m.slug,
        status: geo ? 'created' : 'created (no real coordinates found)',
        id: created.id,
      });
    } catch (err) {
      results.push({ slug: m.slug, status: 'error', details: String(err) });
    }
  }

  res.json(results);
});

app.get('/mandis/regions', async (req, res) => {
  const mandis = await prisma.mandi.findMany({ select: { state: true, district: true } });

  const byState = {};
  for (const m of mandis) {
    if (!byState[m.state]) byState[m.state] = new Set();
    byState[m.state].add(m.district);
  }

  const regions = Object.entries(byState)
    .map(([state, districts]) => ({ state, districts: Array.from(districts).sort() }))
    .sort((a, b) => a.state.localeCompare(b.state));

  res.json(regions);
});

app.post('/mandis', async (req, res) => {
  const { nameEn, nameHi, slug, district, state, latitude, longitude } = req.body;
  const mandi = await prisma.mandi.create({
    data: { nameEn, nameHi, slug, district, state, latitude, longitude },
  });
  res.status(201).json(mandi);
});

app.get('/mandis/:id/weather', async (req, res) => {
  const mandi = await prisma.mandi.findUnique({ where: { id: Number(req.params.id) } });
  if (!mandi) {
    return res.status(404).json({ error: 'Mandi not found' });
  }
  const result = await fetchLiveWeather(mandi);
  res.json({ ...result, fetchedAt: new Date().toISOString() });
});

app.get('/mandis/:mandiId/crops/:cropId/price', async (req, res) => {
  const mandi = await prisma.mandi.findUnique({ where: { id: Number(req.params.mandiId) } });
  const crop = await prisma.crop.findUnique({ where: { id: Number(req.params.cropId) } });
  if (!mandi) return res.status(404).json({ error: 'Mandi not found' });
  if (!crop) return res.status(404).json({ error: 'Crop not found' });
  const result = await fetchLivePrice(crop, mandi);
  res.json({ ...result, fetchedAt: new Date().toISOString() });
});

app.get('/mandis/:mandiId/crops/:cropId/price-history', async (req, res) => {
  const mandi = await prisma.mandi.findUnique({ where: { id: Number(req.params.mandiId) } });
  const crop = await prisma.crop.findUnique({ where: { id: Number(req.params.cropId) } });
  if (!mandi) return res.status(404).json({ error: 'Mandi not found' });
  if (!crop) return res.status(404).json({ error: 'Crop not found' });
  const result = await fetchPriceHistory(crop, mandi);
  res.json({ ...result, fetchedAt: new Date().toISOString() });
});

app.post('/chatbot/message', async (req, res) => {
  const { message, farmerName, farmerPhone, history } = req.body;

  if (!message || !farmerPhone) {
    return res.status(400).json({ error: 'message and farmerPhone are required' });
  }

  const crops = await prisma.crop.findMany();
  const mandis = await prisma.mandi.findMany();

  const cropList = crops.map((c) => `id ${c.id}: ${c.nameEn} (${c.nameHi})`).join('\n');
  const mandiList = mandis.map((m) => `id ${m.id}: ${m.nameEn}, ${m.district}, ${m.state}`).join('\n');

  const recentBookings = await prisma.booking.findMany({
    where: { farmerPhone },
    include: { crop: true, mandi: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const bookingSummary = recentBookings.length
    ? recentBookings
        .map(
          (b) =>
            `id ${b.id}, token ${b.tokenNumber}: ${b.quantityQuintal} quintals of ${b.crop.nameEn} at ${b.mandi.nameEn}, slot ${b.slotDate.toDateString()}, status ${b.status}`
        )
        .join('\n')
    : 'This farmer has no bookings yet.';

  const systemInstruction = {
    parts: [
      {
        text: `You are MandiMitra's assistant, helping an Indian farmer named ${farmerName || 'a farmer'} (phone ${farmerPhone}) with mandi slot booking, queue status, payment status, grievances, live crop prices, and weather. Reply in the same language the farmer writes in (Hindi or English). Be brief and clear.

Available crops:
${cropList}

Available mandis:
${mandiList}

This farmer's real recent bookings:
${bookingSummary}

Rules:
- Never call createBooking until the farmer has clearly confirmed the crop, quantity, mandi, and date in their latest message. Always restate the details first and ask "Shall I confirm this booking?" before calling it.
- If you don't understand the farmer's request or it's outside what you can do, say so honestly and list 2-3 things you can help with instead.
- Use real ids from the lists above when calling functions.`,
      },
    ],
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  let contents = [...(history || []), { role: 'user', parts: [{ text: message }] }];
  let finalText = null;
  let loopCount = 0;

  while (loopCount < 5 && finalText === null) {
    loopCount++;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        tools: CHATBOT_TOOLS,
      }),
    });

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: 'Chatbot service error', details: geminiData });
    }

    const candidate = geminiData.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const functionCallPart = parts.find((p) => p.functionCall);

    contents.push({ role: 'model', parts });

    if (!functionCallPart) {
      finalText = parts.map((p) => p.text).filter(Boolean).join('\n') || 'Sorry, I could not generate a response.';
      break;
    }

    const { name, args } = functionCallPart.functionCall;
    const result = await runChatbotFunction(name, args, { farmerName, farmerPhone });

    contents.push({
      role: 'user',
      parts: [{ functionResponse: { name, response: result } }],
    });
  }

  res.json({
    reply: finalText || 'Sorry, I could not complete that request.',
    history: contents,
    fetchedAt: new Date().toISOString(),
  });
});

app.post('/bookings', async (req, res) => {
  const { farmerName, farmerPhone, cropId, mandiId, quantityQuintal, slotDate } = req.body;
  const booking = await prisma.booking.create({
    data: {
      tokenNumber: generateBookingToken(),
      farmerName,
      farmerPhone,
      cropId,
      mandiId,
      quantityQuintal,
      slotDate: new Date(slotDate),
    },
    include: { crop: true, mandi: true },
  });
  res.status(201).json(booking);
});

app.get('/bookings/:id', async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: Number(req.params.id) },
    include: { crop: true, mandi: true },
  });
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  res.json(booking);
});

app.get('/bookings/:id/queue', async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.status !== 'CONFIRMED') {
    return res.json({
      bookingId: booking.id,
      tokenNumber: booking.tokenNumber,
      status: booking.status,
      message: `This booking is no longer waiting in queue. Current status: ${booking.status}`,
    });
  }

  const waitingBookings = await prisma.booking.findMany({
    where: { mandiId: booking.mandiId, status: 'CONFIRMED' },
    orderBy: [{ slotDate: 'asc' }, { createdAt: 'asc' }],
  });

  const position = waitingBookings.findIndex((b) => b.id === booking.id) + 1;

  res.json({
    bookingId: booking.id,
    tokenNumber: booking.tokenNumber,
    mandiId: booking.mandiId,
    positionInQueue: position,
    totalWaiting: waitingBookings.length,
    farmersAhead: position - 1,
    fetchedAt: new Date().toISOString(),
  });
});

app.post('/bookings/:id/status', async (req, res) => {
  const { status } = req.body;

  if (!BOOKING_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${BOOKING_STATUSES.join(', ')}`,
    });
  }

  const existing = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
  if (!existing) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const booking = await prisma.booking.update({
    where: { id: Number(req.params.id) },
    data: { status },
    include: { crop: true, mandi: true },
  });

  res.json(booking);
});

app.get('/bookings', async (req, res) => {
  const { farmerPhone } = req.query;
  const bookings = await prisma.booking.findMany({
    where: farmerPhone ? { farmerPhone } : undefined,
    include: { crop: true, mandi: true },
    // Sort by id as a tiebreaker too, so bookings created in quick
    // succession (same createdAt timestamp) still come back newest-first
    // in a guaranteed, deterministic order.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  res.json(bookings);
});

app.post('/grievances', async (req, res) => {
  const { farmerName, farmerPhone, subject, description, bookingId } = req.body;

  if (!farmerName || !farmerPhone || !subject || !description) {
    return res.status(400).json({ error: 'farmerName, farmerPhone, subject, and description are required' });
  }

  const grievance = await prisma.grievance.create({
    data: {
      ticketNumber: generateTicketNumber(),
      farmerName,
      farmerPhone,
      subject,
      description,
      bookingId: bookingId ? Number(bookingId) : null,
    },
    include: { booking: true },
  });

  res.status(201).json(grievance);
});

app.get('/grievances/:ticketNumber', async (req, res) => {
  const grievance = await prisma.grievance.findUnique({
    where: { ticketNumber: req.params.ticketNumber },
    include: { booking: true },
  });

  if (!grievance) {
    return res.status(404).json({ error: 'Grievance not found' });
  }

  res.json(grievance);
});

app.post('/grievances/:ticketNumber/status', async (req, res) => {
  const { status } = req.body;

  if (!GRIEVANCE_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${GRIEVANCE_STATUSES.join(', ')}`,
    });
  }

  const existing = await prisma.grievance.findUnique({ where: { ticketNumber: req.params.ticketNumber } });
  if (!existing) {
    return res.status(404).json({ error: 'Grievance not found' });
  }

  const grievance = await prisma.grievance.update({
    where: { ticketNumber: req.params.ticketNumber },
    data: { status },
    include: { booking: true },
  });

  res.json(grievance);
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});