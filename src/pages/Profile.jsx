import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Loader2,
  CheckCircle2,
  Phone,
  MapPin,
  Languages,
  LogOut,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES_AND_UTS, INDIAN_DISTRICTS_BY_STATE, LANGUAGES } from '../constants/india';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export function Profile() {
  const { farmer, updateProfile, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(farmer?.name || '');
  const [state, setState] = useState(farmer?.state || '');
  const [district, setDistrict] = useState(farmer?.district || '');
  const [preferredLanguage, setPreferredLanguage] = useState(farmer?.preferredLanguage || 'hi');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleDeleteAccount() {
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteAccount();
      navigate('/login');
    } catch (err) {
      setDeleteError(err.message || 'Could not delete your account. Please try again.');
      setDeleting(false);
    }
  }

  const districts = state ? INDIAN_DISTRICTS_BY_STATE[state] || [] : [];

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (!name.trim() || !state || !district) {
      setError('Please fill in all fields.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), state, district, preferredLanguage });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (!farmer) return null;

  const fieldClass =
    'mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring disabled:opacity-50';

  return (
    <div className="max-w-2xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          मेरी प्रोफाइल · Profile
        </h1>
        <p className="mt-1.5 text-muted-foreground">Manage your farmer profile and settings</p>
      </motion.div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground">{farmer.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {farmer.phone}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4 border-t pt-5">
            <div>
              <label className="text-sm font-medium text-foreground">Full name / पूरा नाम</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Phone number</label>
              <input
                type="tel"
                value={farmer.phone}
                disabled
                className={`${fieldClass} bg-muted text-muted-foreground`}
              />
              <p className="mt-1 text-xs text-muted-foreground/70">
                Phone number cannot be changed here.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" /> State / राज्य
                </label>
                <select
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setDistrict('');
                  }}
                  className={fieldClass}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES_AND_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">District / ज़िला</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={!state}
                  className={fieldClass}
                >
                  <option value="">{state ? 'Select district' : 'Select a state first'}</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Languages className="h-3.5 w-3.5 text-primary" /> Preferred language / भाषा
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className={fieldClass}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Use the language switcher in the top bar to see the app in this language right
                away.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" /> Saved
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="font-heading font-semibold text-foreground">Account</h2>
            <p className="text-sm text-muted-foreground">Sign out of MandiMitra on this device.</p>
          </div>
          <Button type="button" variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h2 className="font-heading font-semibold text-destructive">Danger zone</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Deleting your account permanently removes your profile and login from MandiMitra.
            This cannot be undone. Your past bookings and grievances stay on record (as they
            would at a real mandi office), but you won't be able to log in to view or manage
            them anymore.
          </p>

          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

          {!confirmingDelete ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-4 w-4" /> Delete my account
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-foreground">
                Are you sure? This will permanently delete your MandiMitra account.
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="danger"
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                >
                  {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {deleting ? 'Deleting...' : 'Yes, delete my account'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleting}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
