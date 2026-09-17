const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function getCrops() {
  const res = await fetch(`${API_URL}/crops`);
  if (!res.ok) throw new Error('Could not load crop list.');
  return res.json();
}

export async function getRegions() {
  const res = await fetch(`${API_URL}/mandis/regions`);
  if (!res.ok) throw new Error('Could not load regions.');
  return res.json();
}

export async function getMandis({ state, district } = {}) {
  const params = new URLSearchParams();
  if (state) params.set('state', state);
  if (district) params.set('district', district);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/mandis${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Could not load mandis.');
  return res.json();
}

export async function getCropPrice(mandiId, cropId) {
  const res = await fetch(`${API_URL}/mandis/${mandiId}/crops/${cropId}/price`);
  // A "no live records" response is still a valid 200 reply with an `error` field,
  // not an HTTP failure, so we don't throw here - the caller checks data.error.
  return res.json();
}

// crops is a real array of { cropId, quantityQuintal } - a farmer bringing
// more than one crop on the same trip puts all of them in this one booking
// (one time slot, one queue spot) instead of booking separately per crop.
export async function createBooking({ farmerName, farmerPhone, crops, mandiId, slotDate, timeSlot }) {
  const res = await fetch(`${API_URL}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ farmerName, farmerPhone, crops, mandiId, slotDate, timeSlot }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not create booking.');
  return data;
}

// The real, shared list of bookable time slots, straight from the backend
// (single source of truth - see TIME_SLOTS in server.js) rather than a
// second hardcoded copy on the frontend that could drift out of sync.
export async function getTimeSlots() {
  const res = await fetch(`${API_URL}/time-slots`);
  if (!res.ok) throw new Error('Could not load time slots.');
  const data = await res.json();
  return data.timeSlots;
}

// Real, live availability (booked vs. capacity) for every time slot at a
// mandi on a given date, so the booking form can show farmers which slots
// are already filling up before they pick one.
export async function getSlotAvailability(mandiId, date) {
  const res = await fetch(`${API_URL}/mandis/${mandiId}/slots?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error('Could not load slot availability.');
  return res.json();
}

export async function getBookings({ farmerPhone } = {}) {
  const params = new URLSearchParams();
  if (farmerPhone) params.set('farmerPhone', farmerPhone);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/bookings${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Could not load bookings.');
  return res.json();
}

export async function getBookingQueue(bookingId) {
  const res = await fetch(`${API_URL}/bookings/${bookingId}/queue`);
  if (!res.ok) throw new Error('Could not load queue status.');
  return res.json();
}

export async function updateBookingStatus(bookingId, status) {
  const res = await fetch(`${API_URL}/bookings/${bookingId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Could not update this booking.');
  return data;
}

export async function getCropPriceHistory(mandiId, cropId) {
  const res = await fetch(`${API_URL}/mandis/${mandiId}/crops/${cropId}/price-history`);
  // Same pattern as getCropPrice - a "not enough data" reply is still a
  // valid 200 with an `error`/`points` shape, not an HTTP failure.
  return res.json();
}

export async function sendChatMessage({ message, farmerName, farmerPhone, history }) {
  const res = await fetch(`${API_URL}/chatbot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, farmerName, farmerPhone, history }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong talking to the chatbot.');
  }

  return data;
}

// --- Real farmer authentication, backed by the /auth routes on server.js ---

export async function registerFarmer(data) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Could not create account.');
  return result;
}

export async function loginFarmer(data) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Could not log in.');
  return result;
}

export async function getMe(token) {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Session expired. Please log in again.');
  return res.json();
}

export async function updateMe(token, data) {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Could not update profile.');
  return result;
}

export async function deleteMe(token) {
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Could not delete account.');
  return result;
}
