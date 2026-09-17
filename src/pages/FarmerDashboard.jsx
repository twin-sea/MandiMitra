import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  PhoneCall, X, CheckCircle2, Info, MapPin, AlertCircle, Sparkles, SunMedium,
  ArrowRight, Truck, FileText, Sprout, TrendingUp, Check, Calendar, Navigation,
  Loader2, Users, Wheat,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { getCrops, getMandis, createBooking, getBookings, getBookingQueue, getSlotAvailability } from '../services/api';

function getTodayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function formatSlotDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

const FarmerDashboard = () => {
  const { t } = useTranslation();
  const { farmer } = useAuth();

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [activeNotification, setActiveNotification] = useState(null);

  // --- Real crop + mandi lists, loaded from the real backend ---
  const [crops, setCrops] = useState([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [mandis, setMandis] = useState([]);
  const [mandisLoading, setMandisLoading] = useState(true);

  // --- Real booking form state ---
  // One booking = one real trip to the mandi (one time slot, one queue
  // spot), so a farmer can add more than one crop to the SAME booking
  // instead of needing a separate booking (and a separate slot) per crop.
  // selectedCrops is a real array of { cropId, quantityQuintal }.
  const [selectedCrops, setSelectedCrops] = useState([]);
  const [selectedMandiId, setSelectedMandiId] = useState('');
  const [slotDate, setSlotDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  // Real, live per-slot availability for the chosen mandi+date, fetched
  // fresh from the backend (booked count vs. that mandi's real capacity) -
  // never estimated on the frontend.
  const [slotAvailability, setSlotAvailability] = useState(null);
  const [slotAvailabilityLoading, setSlotAvailabilityLoading] = useState(false);
  const [slotAvailabilityError, setSlotAvailabilityError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // --- The farmer's real current booking (most recent one on their account) ---
  const [currentBooking, setCurrentBooking] = useState(null);
  const [currentBookingLoading, setCurrentBookingLoading] = useState(true);
  const [queueInfo, setQueueInfo] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState('');

  const loadCurrentBooking = useCallback(async () => {
    if (!farmer?.phone) return;
    setCurrentBookingLoading(true);
    try {
      const bookings = await getBookings({ farmerPhone: farmer.phone });
      const latest = bookings && bookings.length > 0 ? bookings[0] : null;
      setCurrentBooking(latest);
      if (latest) {
        try {
          const q = await getBookingQueue(latest.id);
          setQueueInfo(q);
        } catch {
          setQueueInfo(null);
        }
      } else {
        setQueueInfo(null);
      }
    } catch {
      setCurrentBooking(null);
    } finally {
      setCurrentBookingLoading(false);
    }
  }, [farmer?.phone]);

  useEffect(() => {
    if (!farmer) return;

    setCropsLoading(true);
    getCrops()
      .then(setCrops)
      .catch(() => setCrops([]))
      .finally(() => setCropsLoading(false));

    setMandisLoading(true);
    getMandis({ state: farmer.state, district: farmer.district })
      .then(async (list) => {
        if (list && list.length > 0) return list;
        // Fall back to every real mandi in the farmer's state if their exact
        // district doesn't have one yet.
        return getMandis({ state: farmer.state });
      })
      .then(setMandis)
      .catch(() => setMandis([]))
      .finally(() => setMandisLoading(false));

    loadCurrentBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmer?.state, farmer?.district, farmer?.phone]);

  const handleStartBooking = (preselectMandiId) => {
    setConfirmedBooking(null);
    setSelectedCrops([]);
    setSelectedMandiId(preselectMandiId ? String(preselectMandiId) : '');
    setSlotDate('');
    setSelectedTimeSlot('');
    setSlotAvailability(null);
    setSlotAvailabilityError('');
    setSubmitError('');
    setShowBookingModal(true);
  };

  // Adds/removes a crop from this booking, and lets its quantity be edited
  // once it's added. A farmer selling wheat AND mustard on the same trip
  // just toggles both crops on and fills in a quantity for each.
  const toggleCrop = (cropId) => {
    setSelectedCrops((prev) => {
      const exists = prev.some((c) => String(c.cropId) === String(cropId));
      if (exists) return prev.filter((c) => String(c.cropId) !== String(cropId));
      return [...prev, { cropId, quantityQuintal: '' }];
    });
  };

  const setCropQuantity = (cropId, value) => {
    setSelectedCrops((prev) =>
      prev.map((c) => (String(c.cropId) === String(cropId) ? { ...c, quantityQuintal: value } : c))
    );
  };

  // Once a mandi and a date are both picked, fetch the real, live
  // availability for every time slot at that mandi on that date. Re-fetches
  // whenever either changes, and clears any time slot already chosen for a
  // different mandi/date (its availability no longer applies).
  useEffect(() => {
    setSelectedTimeSlot('');
    if (!selectedMandiId || !slotDate) {
      setSlotAvailability(null);
      return;
    }
    let cancelled = false;
    setSlotAvailabilityLoading(true);
    setSlotAvailabilityError('');
    getSlotAvailability(Number(selectedMandiId), slotDate)
      .then((data) => {
        if (!cancelled) setSlotAvailability(data);
      })
      .catch((err) => {
        if (!cancelled) setSlotAvailabilityError(err.message || 'Could not load time slot availability.');
      })
      .finally(() => {
        if (!cancelled) setSlotAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMandiId, slotDate]);

  const handleConfirmBooking = async () => {
    setSubmitError('');
    const hasValidCrops =
      selectedCrops.length > 0 && selectedCrops.every((c) => c.quantityQuintal && Number(c.quantityQuintal) > 0);
    if (!hasValidCrops || !selectedMandiId || !slotDate || !selectedTimeSlot) {
      setSubmitError(t('booking.validation.required'));
      return;
    }
    setSubmitting(true);
    try {
      const booking = await createBooking({
        farmerName: farmer.name,
        farmerPhone: farmer.phone,
        crops: selectedCrops.map((c) => ({ cropId: Number(c.cropId), quantityQuintal: Number(c.quantityQuintal) })),
        mandiId: Number(selectedMandiId),
        slotDate,
        timeSlot: selectedTimeSlot,
      });
      setConfirmedBooking(booking);
      setCurrentBooking(booking);
      loadCurrentBooking();
    } catch (err) {
      setSubmitError(err.message || 'Could not create booking. Please try again.');
      // The slot may have just filled up (or someone else took the last
      // spot) - refresh real availability so the picker reflects reality
      // instead of still showing the slot as open.
      if (selectedMandiId && slotDate) {
        getSlotAvailability(Number(selectedMandiId), slotDate)
          .then(setSlotAvailability)
          .catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenTracking = async () => {
    if (!currentBooking) {
      setActiveNotification(t('queue.noBooking.toast'));
      return;
    }
    setShowTrackingModal(true);
    setQueueLoading(true);
    setQueueError('');
    try {
      const q = await getBookingQueue(currentBooking.id);
      setQueueInfo(q);
    } catch (err) {
      setQueueError(err.message || 'Could not load queue status.');
    } finally {
      setQueueLoading(false);
    }
  };

  // Real mandis near the farmer, quietest (fewest farmers currently waiting)
  // first - this is live data from real confirmed bookings, not a guess.
  const nearbyMandis = [...mandis]
    .sort((a, b) => (a.farmersWaiting || 0) - (b.farmersWaiting || 0))
    .slice(0, 3);

  return (
    <div className="space-y-5 pb-12 max-w-5xl mx-auto">
      {/* Toast alert feedback if any */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-xl shadow-xl flex items-center gap-3"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="text-sm font-semibold">{activeNotification}</span>
            <button
              onClick={() => setActiveNotification(null)}
              className="ml-3 hover:bg-white/15 p-1 rounded-md cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HERO: greeting + primary "book a slot" action, combined into one
          focused section instead of two separate stacked blocks. */}
      <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg">
        <div className="leaf-pattern absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="relative p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
              <MapPin className="h-3.5 w-3.5" />
              {farmer?.district}, {farmer?.state}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
              {t('status.centresActive')}
            </span>
          </div>

          <div className="space-y-1.5">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
              {t('greetings.welcome', { name: farmer?.name || '' })}
            </h1>
            <p className="text-sm sm:text-base text-primary-foreground/85 max-w-2xl">
              {t('dashboard.subtitle')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <Button
              size="lg"
              variant="gold"
              onClick={() => handleStartBooking()}
              className="w-full sm:w-auto min-h-[56px] text-base sm:text-lg font-bold px-8 cursor-pointer"
            >
              <Sprout className="h-5 w-5" />
              <span>{t('actions.bookMandiSlot')}</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <span className="text-xs sm:text-sm font-medium text-primary-foreground/80 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-gold" />
              {t('quickInfo.noCommissions.oneMinute')}
            </span>
          </div>
        </div>
      </section>

      {/* CURRENT ACTIVE BOOKING - the farmer's real, latest booking */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>{t('tabs.currentBooking')}</span>
          </h2>
          {currentBooking && (
            <span className="text-xs text-muted-foreground font-mono font-medium">
              {t('tokens.label')} {currentBooking.tokenNumber}
            </span>
          )}
        </div>

        {currentBookingLoading ? (
          <Card className="shadow-sm">
            <div className="p-8 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading.generic')}
            </div>
          </Card>
        ) : !currentBooking ? (
          <Card className="shadow-sm border-dashed">
            <div className="p-8 text-center space-y-2">
              <p className="font-bold text-foreground">{t('noActiveBooking.title')}</p>
              <p className="text-sm text-muted-foreground">{t('noActiveBooking.description')}</p>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden shadow-sm">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-accent flex items-center justify-center shrink-0">
                    <Wheat className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-lg text-foreground">
                      {(currentBooking.crops || []).map((bc) => bc.crop?.nameEn).join(', ')}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                      {(currentBooking.crops || [])
                        .map((bc) => `${bc.quantityQuintal} Q ${bc.crop?.nameEn}`)
                        .join(' + ')}
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 bg-accent text-accent-foreground text-sm font-bold px-3.5 py-1.5 rounded-full">
                  <CheckCircle2 className="h-4 w-4" />
                  {currentBooking.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/50 p-3.5 rounded-xl space-y-1">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {t('tabs.mandiCentre')}
                  </span>
                  <p className="font-bold text-foreground">
                    {currentBooking.mandi?.nameEn} ({currentBooking.mandi?.nameHi})
                  </p>
                </div>

                <div className="bg-muted/50 p-3.5 rounded-xl space-y-1">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    {t('tabs.scheduledDate')}
                  </span>
                  <p className="font-bold text-foreground">
                    {formatSlotDate(currentBooking.slotDate)}
                    {currentBooking.timeSlot && (
                      <span className="block text-xs font-semibold text-muted-foreground mt-0.5">
                        {currentBooking.timeSlot}
                      </span>
                    )}
                  </p>
                </div>

                <div className="bg-accent p-3.5 rounded-xl space-y-1">
                  <span className="text-xs text-accent-foreground font-semibold flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" />
                    {t('tabs.liveStatus')}
                  </span>
                  {queueInfo && typeof queueInfo.farmersAhead === 'number' ? (
                    <p className="font-bold text-accent-foreground text-sm">
                      {t('queue.farmersAhead.label')} {queueInfo.farmersAhead}
                    </p>
                  ) : (
                    <p className="text-xs text-accent-foreground/80 font-medium">
                      {currentBooking.status}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleOpenTracking}
                  className="w-full sm:w-auto font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Navigation className="h-4 w-4" />
                  <span>{t('quickActions.trackQueue')}</span>
                </Button>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* MANDIS NEAR YOU - real mandis in the farmer's own district/state,
          sorted by real live queue length. No distances or wait-time guesses
          are shown here, because we don't have real data for those yet. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <span>{t('recommendations.title')}</span>
          </h2>
        </div>

        {mandisLoading ? (
          <Card className="shadow-sm">
            <div className="p-6 flex items-center justify-center text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('loading.mandis')}
            </div>
          </Card>
        ) : nearbyMandis.length === 0 ? (
          <Card className="shadow-sm border-dashed">
            <div className="p-6 text-center text-sm text-muted-foreground">{t('no_data_available')}</div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {nearbyMandis.map((mandi, idx) => (
              <Card key={mandi.id} className="p-4 space-y-3 hover:shadow-md transition-shadow">
                {idx === 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gold-foreground bg-gold/25 px-2 py-0.5 rounded-full">
                    <Sparkles className="h-3 w-3" /> {t('recommendation.best.card.header')}
                  </span>
                )}
                <div>
                  <p className="font-bold text-foreground leading-snug">{mandi.nameEn} ({mandi.nameHi})</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mandi.district}, {mandi.state}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {mandi.farmersWaiting > 0
                    ? `${mandi.farmersWaiting} ${t('queue.totalWaiting.label')}`
                    : t('status.available')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStartBooking(mandi.id)}
                  className="w-full font-bold cursor-pointer"
                >
                  {t('actions.bookThisMandi')}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* SECONDARY ACTIONS - kept short; the sidebar already covers full
          navigation, this is just for quick access on mobile. */}
      <section className="grid grid-cols-2 gap-3">
        <button
          onClick={handleOpenTracking}
          className="flex items-center gap-3 p-4 rounded-2xl border bg-card hover:bg-accent transition-colors text-left cursor-pointer min-h-[64px]"
        >
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-sm text-foreground">{t('quickActions.trackQueue')}</span>
        </button>

        <button
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-3 p-4 rounded-2xl border bg-card hover:bg-accent transition-colors text-left cursor-pointer min-h-[64px]"
        >
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            <PhoneCall className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-sm text-foreground">{t('quickActions.kisanHelpdesk')}</span>
        </button>
      </section>

      {/* SAMPLE DATA NOTICE - MSP figures below are illustrative only. */}
      <section className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground space-y-2">
        <div className="flex items-center justify-between font-semibold text-foreground">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-primary" />
            {t('advisory.title')}
          </span>
          <span className="text-[11px] font-normal text-muted-foreground">{t('sampleNote')}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <div className="flex items-center gap-2 bg-background/70 p-2 rounded-lg">
            <SunMedium className="h-4 w-4 text-gold shrink-0" />
            <span>{t('advisory.weather.note')}</span>
          </div>
          <div className="flex items-center gap-2 bg-background/70 p-2 rounded-lg">
            <TrendingUp className="h-4 w-4 text-primary shrink-0" />
            <span>{t('advisory.msp.note')}</span>
          </div>
          <div className="flex items-center gap-2 bg-background/70 p-2 rounded-lg">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span>{t('advisory.tokenReminder.note')}</span>
          </div>
        </div>
      </section>

      {/* Note about the one thing on this page that still isn't wired to
          real numbers (distance/wait-time), kept small and honest. */}
      <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span>{t('demo_prototype')}: {t('demo.notice.description')}</span>
      </div>

      {/* INTERACTIVE MODAL 1: Real Booking Flow */}
      <AnimatePresence>
        {showBookingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl max-w-lg w-full p-6 shadow-2xl border space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <Sprout className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-foreground">
                    {confirmedBooking
                      ? t('modal.booking.title.confirm')
                      : t('modal.booking.title.book')}
                  </h3>
                </div>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!confirmedBooking ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      {t('booking.form.step.crop.label')}
                    </label>
                    <p className="text-[11px] text-muted-foreground mb-1.5">{t('booking.crop.multiSelectHint')}</p>
                    {cropsLoading ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('loading.crops')}
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {crops.map((crop) => {
                          const isSelected = selectedCrops.some((c) => String(c.cropId) === String(crop.id));
                          return (
                            <button
                              key={crop.id}
                              type="button"
                              onClick={() => toggleCrop(crop.id)}
                              className={`p-3 rounded-xl border text-left text-sm font-semibold transition-all min-h-[46px] cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-accent text-accent-foreground ring-2 ring-primary/30 font-bold'
                                  : 'border-border hover:bg-accent text-foreground'
                              }`}
                            >
                              {crop.nameEn} ({crop.nameHi})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {selectedCrops.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-foreground block mb-1.5">
                        {t('booking.form.step.quantity.label')}
                      </label>
                      {selectedCrops.map((sc) => {
                        const crop = crops.find((c) => String(c.id) === String(sc.cropId));
                        return (
                          <div key={sc.cropId} className="flex items-center gap-2">
                            <span className="flex-1 text-sm font-semibold text-foreground truncate">
                              {crop ? `${crop.nameEn} (${crop.nameHi})` : sc.cropId}
                            </span>
                            <input
                              type="number"
                              min="1"
                              step="0.1"
                              value={sc.quantityQuintal}
                              onChange={(e) => setCropQuantity(sc.cropId, e.target.value)}
                              placeholder="e.g. 40"
                              className="w-28 p-2.5 rounded-xl border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      {t('booking.form.step.mandi.label')}
                    </label>
                    {mandisLoading ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('loading.mandis')}
                      </p>
                    ) : mandis.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('no_data_available')}</p>
                    ) : (
                      <select
                        value={selectedMandiId}
                        onChange={(e) => setSelectedMandiId(e.target.value)}
                        className="w-full p-3 rounded-xl border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">{t('booking.select.mandi.placeholder')}</option>
                        {mandis.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nameEn} ({m.nameHi}) - {m.district}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      {t('booking.form.step.date.label')}
                    </label>
                    <input
                      type="date"
                      min={getTodayISODate()}
                      value={slotDate}
                      onChange={(e) => setSlotDate(e.target.value)}
                      className="w-full p-3 rounded-xl border bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      {t('booking.form.step.slot.label')}
                    </label>
                    {!selectedMandiId || !slotDate ? (
                      <p className="text-xs text-muted-foreground">{t('booking.slot.pickDateFirst')}</p>
                    ) : slotAvailabilityLoading ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('booking.slot.loading')}
                      </p>
                    ) : slotAvailabilityError ? (
                      <p className="text-xs text-destructive">{slotAvailabilityError}</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {(slotAvailability?.slots || []).map((slot) => {
                          const isSelected = selectedTimeSlot === slot.timeSlot;
                          return (
                            <button
                              key={slot.timeSlot}
                              type="button"
                              disabled={slot.full}
                              onClick={() => setSelectedTimeSlot(slot.timeSlot)}
                              className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                                isSelected
                                  ? 'border-primary bg-accent text-accent-foreground ring-2 ring-primary/30 font-bold'
                                  : 'border-border hover:bg-accent text-foreground'
                              }`}
                            >
                              <span className="block">{slot.timeSlot}</span>
                              <span className="block mt-0.5 text-[11px] font-medium text-muted-foreground">
                                {slot.full
                                  ? t('booking.slot.full')
                                  : t('booking.slot.spotsLeft', { count: slot.available })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {submitError && <p className="text-xs text-destructive">{submitError}</p>}

                  <div className="pt-2">
                    <Button
                      size="lg"
                      disabled={submitting}
                      className="w-full font-bold text-base cursor-pointer disabled:opacity-60"
                      onClick={handleConfirmBooking}
                    >
                      <span>{submitting ? t('booking.submitting') : t('actions.confirmBooking')}</span>
                      {!submitting && <ArrowRight className="h-5 w-5" />}
                      {submitting && <Loader2 className="h-5 w-5 animate-spin" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 space-y-4">
                  <div className="h-16 w-16 bg-accent text-primary rounded-full flex items-center justify-center mx-auto">
                    <Check className="h-9 w-9 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="font-heading text-xl font-bold text-foreground">
                      {t('notification.success.booking.title')}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('tokens.label')} <strong className="text-foreground">{confirmedBooking.tokenNumber}</strong>
                    </p>
                  </div>
                  <div className="bg-muted p-4 rounded-xl text-left text-xs space-y-2">
                    <div>
                      <strong>{t('modal.bookingDetails.crop.label')}</strong>{' '}
                      {(confirmedBooking.crops || [])
                        .map((bc) => `${bc.crop?.nameEn} (${bc.quantityQuintal} Q)`)
                        .join(', ')}
                    </div>
                    <div>
                      <strong>{t('modal.bookingDetails.centreName.label')}</strong> {confirmedBooking.mandi?.nameEn} ({confirmedBooking.mandi?.nameHi})
                    </div>
                    <div>
                      <strong>{t('modal.bookingDetails.date.label')}</strong> {formatSlotDate(confirmedBooking.slotDate)}
                    </div>
                    {confirmedBooking.timeSlot && (
                      <div>
                        <strong>{t('modal.bookingDetails.slot.label')}</strong> {confirmedBooking.timeSlot}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full font-bold cursor-pointer"
                    onClick={() => {
                      setShowBookingModal(false);
                      setActiveNotification(t('notification.new.booking.added'));
                    }}
                  >
                    {t('button.back.to.dashboard')}
                  </Button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INTERACTIVE MODAL 2: Real Queue Tracker */}
      <AnimatePresence>
        {showTrackingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl max-w-lg w-full p-6 shadow-2xl border space-y-5"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-foreground">
                      {t('modal.queue.title.live')}
                    </h3>
                    {currentBooking && (
                      <span className="text-xs text-muted-foreground">
                        {currentBooking.mandi?.nameEn}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowTrackingModal(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {queueLoading ? (
                <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('loading.generic')}
                </div>
              ) : queueError ? (
                <p className="text-sm text-destructive text-center py-6">{queueError}</p>
              ) : queueInfo ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-accent text-center space-y-1">
                    <span className="text-xs font-semibold text-accent-foreground">
                      {t('yourVehicleToken')}
                    </span>
                    <div className="text-2xl font-black text-accent-foreground">
                      {queueInfo.tokenNumber}
                    </div>
                  </div>

                  {typeof queueInfo.positionInQueue === 'number' ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
                        <span className="text-muted-foreground font-medium">{t('queue.position.label')}</span>
                        <span className="font-bold text-foreground">#{queueInfo.positionInQueue}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
                        <span className="text-muted-foreground font-medium">{t('queue.farmersAhead.label')}</span>
                        <span className="font-bold text-foreground">{queueInfo.farmersAhead}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-muted">
                        <span className="text-muted-foreground font-medium">{t('queue.totalWaiting.label')}</span>
                        <span className="font-bold text-foreground">{queueInfo.totalWaiting}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">{queueInfo.message}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{t('noActiveBooking.description')}</p>
              )}

              <Button
                variant="outline"
                className="w-full font-bold cursor-pointer"
                onClick={() => setShowTrackingModal(false)}
              >
                {t('closeTrackerBtn')}
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INTERACTIVE MODAL 3: Kisan Helpline */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-5"
            >
              <div className="flex justify-between items-center border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-foreground">
                    {t('modal.helpdesk.title')}
                  </h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-accent cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted text-center space-y-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t('tollFreeLabel')}
                  </span>
                  <div className="text-2xl font-black text-primary">
                    1800-180-1551
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('workingHours')}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl border flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{t('karnalMandiHelpdesk')}</p>
                      <p className="text-muted-foreground">{t('nodeOfficer')}</p>
                    </div>
                    <span className="font-mono font-bold text-primary">
                      +91 98120-XXXXX
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{t('whatsappSupport')}</p>
                      <p className="text-muted-foreground">{t('whatsappDesc')}</p>
                    </div>
                    <span className="bg-accent text-accent-foreground text-[11px] font-bold px-2 py-0.5 rounded">
                      {t('available')}
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full font-bold cursor-pointer"
                  onClick={() => setShowHelpModal(false)}
                >
                  {t('gotItBtn')}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FarmerDashboard;
