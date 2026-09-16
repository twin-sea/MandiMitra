import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sprout, Loader2, Eye, EyeOff, User, Phone, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { INDIAN_STATES_AND_UTS, INDIAN_DISTRICTS_BY_STATE, LANGUAGES } from '../constants/india';
import { Button } from '../components/ui/Button';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('hi');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const districts = state ? INDIAN_DISTRICTS_BY_STATE[state] || [] : [];

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim() || !password || !state || !district) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        state,
        district,
        preferredLanguage,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    'w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring';
  const selectClass =
    'mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring disabled:opacity-50';

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary leaf-pattern items-center justify-center p-12 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md text-center space-y-6"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur-sm">
            <Sprout className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-primary-foreground">
            Join MandiMitra
          </h1>
          <p className="text-primary-foreground/85 text-base leading-relaxed">
            One account gets you real-time slot booking at mandis near you, live queue tracking,
            and mandi price advisories in your own language.
          </p>
        </motion.div>
      </div>

      <div className="flex flex-1 items-center justify-center p-4 py-10 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="flex justify-center lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sprout className="h-6 w-6" />
            </div>
          </div>

          <div className="space-y-1 text-center lg:text-left">
            <h2 className="font-heading text-2xl font-bold text-foreground">Create your account</h2>
            <p className="text-sm text-muted-foreground">किसान पंजीकरण · Farmer registration</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Full name / पूरा नाम</label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Ramesh Patel"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Phone number / फ़ोन नंबर
              </label>
              <div className="relative mt-1.5">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldClass}
                  placeholder="10-digit mobile number"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">Password</label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldClass} pr-9`}
                    placeholder="6+ characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Confirm</label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`${fieldClass} pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">State / राज्य</label>
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setDistrict('');
                }}
                className={selectClass}
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
                className={selectClass}
              >
                <option value="">{state ? 'Select district' : 'Select a state first'}</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Preferred language / भाषा चुनें
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className={selectClass}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={submitting} size="lg" className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Log in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
