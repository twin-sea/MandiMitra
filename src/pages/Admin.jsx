import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Loader2,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Users,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { getMandis, getSlotAvailability, adminCancelSlot } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const ADMIN_KEY_STORAGE = 'mandimitra_admin_key';

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

// Mandi-staff console - NOT part of the farmer-facing app. A real mandi
// employee uses this to cancel a whole time slot (equipment failure,
// weather, staff shortage) when it genuinely happens, which opens a capped
// same-day emergency slot and flags every real affected booking so the
// farmer sees a real choice next time they open the app: come today at the
// emergency slot, or move to the next available slot with priority.
// Protected by the real ADMIN_KEY set on the backend - this page never
// works without mandi staff typing the correct key first.
export function Admin() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || '');
  const [keyInput, setKeyInput] = useState('');

  const [mandis, setMandis] = useState([]);
  const [mandisLoading, setMandisLoading] = useState(true);
  const [selectedMandiId, setSelectedMandiId] = useState('');
  const [date, setDate] = useState(getTodayISODate());

  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  const [cancelSlot, setCancelSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [emergencyTimeSlot, setEmergencyTimeSlot] = useState('18:00-19:30 (Emergency)');
  const [emergencyCapacity, setEmergencyCapacity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    getMandis()
      .then((list) => {
        setMandis(list);
        if (list.length > 0) setSelectedMandiId(String(list[0].id));
      })
      .catch(() => setMandis([]))
      .finally(() => setMandisLoading(false));
  }, []);

  function loadSlots() {
    if (!selectedMandiId || !date || !adminKey) return;
    setSlotsLoading(true);
    setSlotsError('');
    getSlotAvailability(Number(selectedMandiId), date)
      .then(setSlots)
      .catch((err) => setSlotsError(err.message || 'Could not load slot data.'))
      .finally(() => setSlotsLoading(false));
  }

  useEffect(() => {
    if (adminKey) loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMandiId, date, adminKey]);

  function unlockConsole() {
    if (!keyInput.trim()) return;
    sessionStorage.setItem(ADMIN_KEY_STORAGE, keyInput.trim());
    setAdminKey(keyInput.trim());
  }

  function lockConsole() {
    sessionStorage.removeItem(ADMIN_KEY_STORAGE);
    setAdminKey('');
    setKeyInput('');
  }

  function openCancelForm(slot) {
    setCancelSlot(slot);
    setReason('');
    setEmergencyTimeSlot('18:00-19:30 (Emergency)');
    setEmergencyCapacity(String(slot.booked));
    setFormError('');
    setResult(null);
  }

  async function submitCancellation() {
    setFormError('');
    if (!reason.trim()) {
      setFormError('Please enter a real reason for the cancellation.');
      return;
    }
    const capacity = Number(emergencyCapacity);
    if (!Number.isInteger(capacity) || capacity <= 0) {
      setFormError('Emergency capacity must be a whole number greater than 0.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await adminCancelSlot(adminKey, Number(selectedMandiId), {
        slotDate: date,
        timeSlot: cancelSlot.timeSlot,
        reason: reason.trim(),
        emergencyTimeSlot: emergencyTimeSlot.trim(),
        emergencyCapacity: capacity,
      });
      setResult(data);
      setCancelSlot(null);
      loadSlots();
    } catch (err) {
      if (err.message === 'Invalid or missing admin key.') {
        lockConsole();
      } else {
        setFormError(err.message || 'Could not cancel this slot.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!adminKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card>
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-heading text-lg font-bold text-foreground">Mandi staff console</h1>
                  <p className="text-xs text-muted-foreground">Not part of the farmer app</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter the admin key configured on the backend (ADMIN_KEY) to manage slot cancellations.
              </p>
              <div>
                <label className="text-sm font-medium text-foreground">Admin key</label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && unlockConsole()}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter admin key"
                />
              </div>
              <Button className="w-full" onClick={unlockConsole}>
                <KeyRound className="h-4 w-4" /> Unlock
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Mandi staff console</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cancel a whole time slot and open an emergency slot for it</p>
          </div>
          <Button variant="outline" size="sm" onClick={lockConsole}>
            <LogOut className="h-3.5 w-3.5" /> Lock
          </Button>
        </div>

        <Card>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Mandi</label>
              <select
                value={selectedMandiId}
                onChange={(e) => setSelectedMandiId(e.target.value)}
                disabled={mandisLoading}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {mandis.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nameEn}, {m.district}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </Card>

        {result && (
          <Card className="border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3 p-5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">Slot cancelled</p>
                <p className="mt-0.5 text-muted-foreground">
                  {result.affectedBookings} farmer{result.affectedBookings === 1 ? '' : 's'} will see a choice
                  (today's emergency slot or the next available slot) next time they open the app.
                </p>
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-primary" /> Time slots on {date}
            </div>

            {slotsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : slotsError ? (
              <p className="py-6 text-center text-sm text-destructive">{slotsError}</p>
            ) : slots ? (
              <div className="space-y-2">
                {slots.slots.map((slot) => (
                  <div
                    key={slot.timeSlot}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{slot.timeSlot}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {slot.booked} / {slot.capacity} booked
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={slot.booked === 0}
                      onClick={() => openCancelForm(slot)}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" /> Cancel this slot
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        {cancelSlot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md space-y-4 rounded-2xl border bg-background p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground">
                    Cancel {cancelSlot.timeSlot} on {date}?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Affects {cancelSlot.booked} confirmed booking{cancelSlot.booked === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Reason</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Weighing equipment failure"
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Emergency slot (today)</label>
                <input
                  value={emergencyTimeSlot}
                  onChange={(e) => setEmergencyTimeSlot(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Emergency slot capacity</label>
                <input
                  type="number"
                  min="1"
                  value={emergencyCapacity}
                  onChange={(e) => setEmergencyCapacity(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  How many of the affected farmers can realistically be seen today in this extra window.
                </p>
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCancelSlot(null)} disabled={submitting}>
                  Back
                </Button>
                <Button variant="danger" className="flex-1" onClick={submitCancellation} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? 'Cancelling...' : 'Confirm cancellation'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
