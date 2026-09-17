import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Truck, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getBookings, getBookingQueue } from '../services/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function TrackQueue() {
  const { farmer } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [queueInfo, setQueueInfo] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');

  useEffect(() => {
    if (!farmer?.phone) return;
    setBookingsLoading(true);
    getBookings({ farmerPhone: farmer.phone })
      .then((list) => {
        setBookings(list);
        if (list.length > 0) setSelectedId(String(list[0].id));
      })
      .catch(() => setBookings([]))
      .finally(() => setBookingsLoading(false));
  }, [farmer?.phone]);

  const loadQueue = useCallback(async (id) => {
    if (!id) return;
    setQueueLoading(true);
    setQueueError('');
    try {
      const q = await getBookingQueue(id);
      setQueueInfo(q);
    } catch (err) {
      setQueueError(err.message || 'Could not load queue status.');
    } finally {
      setQueueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadQueue(selectedId);
  }, [selectedId, loadQueue]);

  const selectedBooking = bookings.find((b) => String(b.id) === selectedId);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          कतार देखें · Track Queue
        </h1>
        <p className="mt-1.5 text-muted-foreground">Live queue status for your bookings</p>
      </motion.div>

      {bookingsLoading ? (
        <Card>
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your bookings...
          </div>
        </Card>
      ) : bookings.length === 0 ? (
        <Card className="border-dashed">
          <div className="space-y-2 p-10 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="font-semibold text-foreground">No bookings to track</p>
            <p className="text-sm text-muted-foreground">
              Book a mandi slot from your dashboard, then come back here to track it.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {bookings.length > 1 && (
            <div>
              <label className="text-sm font-medium text-foreground">Select a booking</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1.5 w-full max-w-sm rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
              >
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {(b.crops || []).map((bc) => bc.crop?.nameEn).join(', ')} · {b.mandi?.nameEn} · {b.tokenNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-foreground">
                      {selectedBooking?.mandi?.nameEn}
                      {selectedBooking?.mandi?.nameHi ? ` (${selectedBooking.mandi.nameHi})` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Token: <span className="font-mono">{selectedBooking?.tokenNumber}</span>
                      {selectedBooking?.timeSlot ? ` · ${selectedBooking.timeSlot}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadQueue(selectedId)}
                  disabled={queueLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${queueLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {queueLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading queue status...
                </div>
              ) : queueError ? (
                <p className="py-6 text-center text-sm text-destructive">{queueError}</p>
              ) : queueInfo ? (
                <div className="space-y-4">
                  <div className="space-y-1 rounded-xl bg-accent p-4 text-center">
                    <span className="text-xs font-semibold text-accent-foreground">
                      Your vehicle token
                    </span>
                    <div className="text-2xl font-black text-accent-foreground">
                      {queueInfo.tokenNumber}
                    </div>
                  </div>

                  {typeof queueInfo.positionInQueue === 'number' ? (
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <div className="flex items-center justify-between rounded-xl bg-muted p-3 sm:flex-col sm:items-start sm:gap-1">
                        <span className="font-medium text-muted-foreground">Position</span>
                        <span className="font-bold text-foreground">
                          #{queueInfo.positionInQueue}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-muted p-3 sm:flex-col sm:items-start sm:gap-1">
                        <span className="font-medium text-muted-foreground">Farmers ahead</span>
                        <span className="font-bold text-foreground">{queueInfo.farmersAhead}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-muted p-3 sm:flex-col sm:items-start sm:gap-1">
                        <span className="font-medium text-muted-foreground">Total waiting</span>
                        <span className="font-bold text-foreground">{queueInfo.totalWaiting}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="py-2 text-center text-sm text-muted-foreground">
                      {queueInfo.message}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
