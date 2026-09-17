import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Loader2,
  Wheat,
  MapPin,
  Calendar,
  Hash,
  QrCode,
  Printer,
  X,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBookings, updateBookingStatus } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

function formatSlotDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusStyle(status) {
  switch ((status || '').toUpperCase()) {
    case 'CONFIRMED':
      return 'bg-accent text-accent-foreground';
    case 'ARRIVED':
      return 'bg-gold text-gold-foreground';
    case 'COMPLETED':
      return 'bg-primary text-primary-foreground';
    case 'CANCELLED':
      return 'bg-destructive/10 text-destructive';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function MyBookings() {
  const { farmer } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [passBooking, setPassBooking] = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');

  function loadBookings() {
    if (!farmer?.phone) return;
    setLoading(true);
    setError('');
    getBookings({ farmerPhone: farmer.phone })
      .then(setBookings)
      .catch((err) => setError(err.message || 'Could not load your bookings.'))
      .finally(() => setLoading(false));
  }

  useEffect(loadBookings, [farmer?.phone]);

  async function confirmCancel() {
    if (!cancelBooking) return;
    setCancelling(true);
    setActionError('');
    try {
      await updateBookingStatus(cancelBooking.id, 'CANCELLED');
      setCancelBooking(null);
      loadBookings();
    } catch (err) {
      setActionError(err.message || 'Could not cancel this booking.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          मेरी बुकिंग · My Bookings
        </h1>
        <p className="mt-1.5 text-muted-foreground">Your full mandi slot booking history</p>
      </motion.div>

      {loading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your bookings...
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="p-8 text-center text-sm text-destructive">{error}</div>
        </Card>
      ) : bookings.length === 0 ? (
        <Card className="border-dashed">
          <div className="space-y-2 p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="font-semibold text-foreground">No bookings yet</p>
            <p className="text-sm text-muted-foreground">
              Head to your dashboard to book your first mandi slot.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
            >
              <Card className="overflow-hidden">
                <div className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                        <Wheat className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground">
                          {b.crop?.nameEn}
                          {b.crop?.nameHi ? ` (${b.crop.nameHi})` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.quantityQuintal} Quintals
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle(b.status)}`}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        {b.mandi?.nameEn}
                        {b.mandi?.nameHi ? ` (${b.mandi.nameHi})` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                      {formatSlotDate(b.slotDate)}
                      {b.timeSlot ? ` · ${b.timeSlot}` : ''}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-mono">{b.tokenNumber}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button variant="outline" size="sm" onClick={() => setPassBooking(b)}>
                      <QrCode className="h-3.5 w-3.5" /> View pass
                    </Button>
                    {b.status === 'CONFIRMED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setActionError('');
                          setCancelBooking(b);
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancel booking
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Printable pass modal - shows the real token as a QR code, and prints
          cleanly on its own (see the .printable-pass print rule in index.css). */}
      <AnimatePresence>
        {passBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl border bg-background p-6 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between print:hidden">
                <h3 className="font-heading text-lg font-bold text-foreground">Booking pass</h3>
                <button
                  onClick={() => setPassBooking(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="printable-pass space-y-4 text-center">
                <div>
                  <p className="font-heading text-xl font-bold text-foreground">MandiMitra</p>
                  <p className="text-xs text-muted-foreground">Mandi Slot Booking Pass</p>
                </div>

                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                    passBooking.tokenNumber
                  )}`}
                  alt={`QR code for token ${passBooking.tokenNumber}`}
                  className="mx-auto h-44 w-44 rounded-xl border p-2"
                  width={176}
                  height={176}
                />

                <div className="font-mono text-2xl font-black tracking-wide text-primary">
                  {passBooking.tokenNumber}
                </div>

                <div className="space-y-1 rounded-xl bg-muted p-4 text-left text-sm">
                  <p>
                    <span className="text-muted-foreground">Farmer: </span>
                    <span className="font-semibold text-foreground">{farmer?.name}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Crop: </span>
                    <span className="font-semibold text-foreground">
                      {passBooking.crop?.nameEn} ({passBooking.crop?.nameHi})
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Mandi: </span>
                    <span className="font-semibold text-foreground">
                      {passBooking.mandi?.nameEn}
                    </span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Date: </span>
                    <span className="font-semibold text-foreground">
                      {formatSlotDate(passBooking.slotDate)}
                    </span>
                  </p>
                  {passBooking.timeSlot && (
                    <p>
                      <span className="text-muted-foreground">Time Slot: </span>
                      <span className="font-semibold text-foreground">{passBooking.timeSlot}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex gap-2 print:hidden">
                <Button variant="outline" className="flex-1" onClick={() => setPassBooking(null)}>
                  Close
                </Button>
                <Button className="flex-1" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel confirmation modal */}
      <AnimatePresence>
        {cancelBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm space-y-4 rounded-2xl border bg-background p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground">Cancel this booking?</h3>
                  <p className="text-xs text-muted-foreground">
                    Token {cancelBooking.tokenNumber} - this cannot be undone.
                  </p>
                </div>
              </div>

              {actionError && <p className="text-sm text-destructive">{actionError}</p>}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setCancelBooking(null)}
                  disabled={cancelling}
                >
                  Keep booking
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={confirmCancel}
                  disabled={cancelling}
                >
                  {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                  {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
