import React, { useState, useMemo, useEffect, useRef } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Lock, UnlockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import loginBg1 from '../assets/payrecover-login-bg-1.png'
import loginBg2 from '../assets/payrecover-login-bg-2.png'
import loginBg3 from '../assets/payrecover-login-bg-3.png'
import loginBg4 from '../assets/payrecover-login-bg-4.png'
import loginBg5 from '../assets/payrecover-login-bg-5.png'
import loginBg6 from '../assets/payrecover-login-bg-6.png'

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_ATTEMPTS   = 3
const LOCK_DURATION  = 15 * 60          // 15 minutes in seconds

// localStorage keys scoped to the normalised email
const ATTEMPTS_KEY   = (e) => `prai_attempts_${e.toLowerCase().trim()}`
const LOCK_UNTIL_KEY = (e) => `prai_lock_until_${e.toLowerCase().trim()}`

// ─── Password strength rules ──────────────────────────────────────────────────
const PASSWORD_RULES = [
  { id: 'length',    label: 'At least 6 characters',           test: (p) => p.length >= 6 },
  { id: 'uppercase', label: 'One uppercase letter (A–Z)',       test: (p) => /[A-Z]/.test(p) },
  { id: 'number',    label: 'One number (0–9)',                 test: (p) => /[0-9]/.test(p) },
  { id: 'special',   label: 'One special character (!@#$%^&*)', test: (p) => /[!@#$%^&*]/.test(p) },
]

// ─── localStorage helpers ─────────────────────────────────────────────────────
function readAttempts(email) {
  if (!email) return 0
  try { return parseInt(localStorage.getItem(ATTEMPTS_KEY(email)) || '0', 10) } catch { return 0 }
}

function writeAttempts(email, n) {
  if (!email) return
  try {
    if (n <= 0) localStorage.removeItem(ATTEMPTS_KEY(email))
    else        localStorage.setItem(ATTEMPTS_KEY(email), String(n))
  } catch { /* storage unavailable – degrade silently */ }
}

function readLockUntil(email) {
  if (!email) return 0
  try { return parseInt(localStorage.getItem(LOCK_UNTIL_KEY(email)) || '0', 10) } catch { return 0 }
}

function writeLockUntil(email, unixMs) {
  if (!email) return
  try {
    if (!unixMs) localStorage.removeItem(LOCK_UNTIL_KEY(email))
    else         localStorage.setItem(LOCK_UNTIL_KEY(email), String(unixMs))
  } catch { /* degrade silently */ }
}

function clearLock(email) {
  writeLockUntil(email, 0)
  writeAttempts(email, 0)
}

/** Returns remaining lock seconds for the email (0 = not locked). */
function getLockSecondsRemaining(email) {
  const until = readLockUntil(email)
  if (!until) return 0
  const remaining = Math.ceil((until - Date.now()) / 1000)
  return remaining > 0 ? remaining : 0
}

/** Format seconds as MM:SS */
function formatCountdown(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ─── Sub-component: password rule row ────────────────────────────────────────
function PasswordRuleItem({ satisfied, label }) {
  return (
    <li className={`flex items-center gap-2 text-xs transition-colors ${satisfied ? 'text-emerald-600' : 'text-red-500'}`}>
      {satisfied
        ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        : <XCircle      className="w-3.5 h-3.5 flex-shrink-0" />}
      {label}
    </li>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Auth() {
  const [mode,     setMode]     = useState('signup')
  const [fullName, setFullName] = useState('')
  const [shopName, setShopName] = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [message,  setMessage]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [currentBg, setCurrentBg] = useState(0)

const loginBackgrounds = [
  loginBg1,
  loginBg2,
  loginBg3,
  loginBg4,
  loginBg5,
  loginBg6,
]
useEffect(() => {
  const interval = setInterval(() => {
    setCurrentBg((prev) => (prev + 1) % loginBackgrounds.length)
  }, 4000)

  return () => clearInterval(interval)
}, [])

  // Live countdown seconds for the current email's lock (0 = not locked)
  const [secondsLeft, setSecondsLeft] = useState(0)
  // Whether the lock just expired this session (to show the "unlocked" toast once)
  const [justUnlocked, setJustUnlocked] = useState(false)

  // Ref to the interval so we can clear it reliably
  const intervalRef = useRef(null)

  // ── Countdown effect — re-runs whenever email changes ──────────────────────
  useEffect(() => {
    // Clear any existing ticker first
    if (intervalRef.current) clearInterval(intervalRef.current)
    setJustUnlocked(false)

    const initial = getLockSecondsRemaining(email)
    setSecondsLeft(initial)

    if (initial <= 0) return // not locked — nothing to do

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Lock has expired
          clearInterval(intervalRef.current)
          clearLock(email)
          setJustUnlocked(true)
          setMessage('')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [email])

  // ── Derived lock state ──────────────────────────────────────────────────────
  const isLocked = secondsLeft > 0

  // ── Password strength ───────────────────────────────────────────────────────
  const ruleResults   = useMemo(() => PASSWORD_RULES.map((r) => ({ ...r, satisfied: r.test(password) })), [password])
  const allRulesPassed = ruleResults.every((r) => r.satisfied)

  // ── Mode switching ──────────────────────────────────────────────────────────
  function switchMode(next) {
    setMode(next)
    setMessage('')
    setJustUnlocked(false)
  }

  // ── Form submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage('')
    setJustUnlocked(false)

    if (mode === 'signin' && isLocked) return // belt-and-suspenders guard

    setLoading(true)

    if (mode === 'signup') {
      // ── Signup — completely unchanged ───────────────────────────────────────
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, shop_name: shopName } },
      })
      setMessage(error ? error.message : 'Account created successfully!')
    } else {
      // ── Sign-in with lockout tracking ───────────────────────────────────────
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        const newCount = readAttempts(email) + 1
        writeAttempts(email, newCount)

        if (newCount >= MAX_ATTEMPTS) {
          // Stamp the lock expiry and start the countdown
          const until = Date.now() + LOCK_DURATION * 1000
          writeLockUntil(email, until)

          // Kick off the interval immediately (mirrors the useEffect logic)
          if (intervalRef.current) clearInterval(intervalRef.current)
          setSecondsLeft(LOCK_DURATION)

          intervalRef.current = setInterval(() => {
            setSecondsLeft((prev) => {
              if (prev <= 1) {
                clearInterval(intervalRef.current)
                clearLock(email)
                setJustUnlocked(true)
                setMessage('')
                return 0
              }
              return prev - 1
            })
          }, 1000)
        } else {
          const left = MAX_ATTEMPTS - newCount
          setMessage(`Incorrect email or password. ${left} attempt${left === 1 ? '' : 's'} remaining.`)
        }
      } else {
        // ── Success — clear lock and counters ───────────────────────────────
        if (intervalRef.current) clearInterval(intervalRef.current)
        clearLock(email)
        setSecondsLeft(0)
        setJustUnlocked(false)
      }
    }

    setLoading(false)
  }

  // ── Forgot password — unchanged ─────────────────────────────────────────────
  const handleForgotPassword = async () => {
    if (!email) { setMessage('Please enter your email address first.'); return }
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setMessage(error ? error.message : 'Password reset email sent.')
    setLoading(false)
  }

  // ── Email field change — re-sync lock state ─────────────────────────────────
  function handleEmailChange(e) {
    setEmail(e.target.value)
    setMessage('')
    setJustUnlocked(false)
    // useEffect will re-run and update secondsLeft automatically
  }

  // ── Submit disabled ─────────────────────────────────────────────────────────
  const submitDisabled =
    loading ||
    (mode === 'signin' && isLocked) ||
    (mode === 'signup' && !allRulesPassed)

  // ───────────────────────────────────────────────────────────────────────────
   return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-[#020b19]">

      {/* =========================================================
          LEFT — FUTURISTIC PAYRECOVER AI
      ========================================================= */}
      <div className="hidden md:flex md:w-[62%] min-h-screen relative overflow-hidden text-white">

     {/* ───────────────── SLIDESHOW PHOTO AREA ───────────────── */}
<div className="absolute left-0 right-0 top-[405px] bottom-0 overflow-hidden">
  <img
    key={currentBg}
    src={loginBackgrounds[currentBg]}
    alt=""
    className="absolute inset-0 w-full h-full object-cover opacity-90 transition-opacity duration-1000"
    draggable="false"
  />

  {/* Soft futuristic overlay */}
  <div className="absolute inset-0 bg-gradient-to-b from-[#020b19]/20 via-[#020b19]/25 to-[#020b19]/45" />
</div>
        {/* Blue glow */}
        <div className="absolute right-[12%] top-[35%] w-[420px] h-[420px] rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute left-[25%] bottom-[-100px] w-[500px] h-[300px] rounded-full bg-blue-600/20 blur-[100px]" />

        <div className="relative z-10 w-full px-8 lg:px-10 py-7">

          {/* ───────────────── TOP BRAND ───────────────── */}
          <div className="flex items-start justify-between">

            <div className="flex items-start gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 shadow-[0_0_30px_rgba(37,99,235,0.45)]">
                <svg
                  className="h-6 w-6 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M12 3l2.2 6.8H21l-5.5 4 2.1 6.7-5.6-4.1-5.6 4.1 2.1-6.7-5.5-4h6.8L12 3z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              <div>
                <h1 className="text-[28px] lg:text-[30px] font-bold tracking-tight">
                  PayRecover <span className="text-cyan-400">AI</span>
                </h1>

                <p className="mt-0.5 text-sm text-blue-200/75">
                  Built for Razorpay AI Buildathon
                </p>
              </div>

            </div>

            {/* AI BADGE */}
            <div className="hidden lg:flex items-center gap-2 rounded-full border border-cyan-400/50 bg-blue-950/40 px-5 py-2 text-sm backdrop-blur-md">
              <span className="text-cyan-400 text-lg">⚡</span>
              <span className="text-blue-100">AI • Secure •</span>
              <span className="text-cyan-400 font-semibold">Reliable</span>
            </div>

          </div>


          {/* ───────────────── FEATURE CARDS ───────────────── */}
          <div className="mt-8 grid grid-cols-4 gap-3">

            {/* CARD 1 */}
            <div className="rounded-2xl border border-blue-400/35 bg-[#061a35]/75 p-4 backdrop-blur-xl shadow-[inset_0_0_25px_rgba(37,99,235,0.06)] hover:border-cyan-400/60 transition-all duration-300">

              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 text-2xl">
                🤖
              </div>

              <h3 className="text-[15px] font-bold">
                AI Diagnosis
              </h3>

              <p className="mt-2 text-xs leading-5 text-blue-100/75">
                Find failure reasons instantly
              </p>

              <div className="mt-2 text-right text-xl text-blue-300">
                →
              </div>

            </div>


            {/* CARD 2 */}
            <div className="rounded-2xl border border-cyan-400/30 bg-[#061a35]/75 p-4 backdrop-blur-xl shadow-[inset_0_0_25px_rgba(6,182,212,0.05)] hover:border-cyan-400/60 transition-all duration-300">

              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-2xl">
                ⚡
              </div>

              <h3 className="text-[15px] font-bold">
                Smart Retry
              </h3>

              <p className="mt-2 text-xs leading-5 text-blue-100/75">
                Auto-retry & smart recovery
              </p>

              <div className="mt-2 text-right text-xl text-blue-300">
                →
              </div>

            </div>


            {/* CARD 3 */}
            <div className="rounded-2xl border border-purple-400/35 bg-[#061a35]/75 p-4 backdrop-blur-xl hover:border-purple-400/60 transition-all duration-300">

              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/15 text-2xl">
                🛡
              </div>

              <h3 className="text-[15px] font-bold">
                Guardrails
              </h3>

              <p className="mt-2 text-xs leading-5 text-blue-100/75">
                Safe & controlled AI decisions
              </p>

              <div className="mt-2 text-right text-xl text-blue-300">
                →
              </div>

            </div>


            {/* CARD 4 */}
            <div className="rounded-2xl border border-blue-400/35 bg-[#061a35]/75 p-4 backdrop-blur-xl hover:border-cyan-400/60 transition-all duration-300">

              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-pink-500/15 text-2xl">
                📊
              </div>
{/* ───────────────── HERO TEXT ───────────────── */}
              <h3 className="text-[15px] font-bold">
                Revenue Growth
              </h3>

              <p className="mt-2 text-xs leading-5 text-blue-100/75">
                Track & recover lost revenue
              </p>

              <div className="mt-2 text-right text-xl text-blue-300">
                →
              </div>

            </div>

          </div>


         {/* ───────────────── BACKGROUND PHOTO SLIDESHOW ───────────────── */}
<div className="mt-8 w-full overflow-hidden rounded-3xl border border-blue-400/30 bg-[#031329] shadow-[0_0_50px_rgba(0,120,255,0.15)]">

  <div className="relative h-[430px] w-full overflow-hidden">

    {/* Current photo */}
    <img
      key={currentBg}
      src={loginBackgrounds[currentBg]}
      alt=""
      className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
      draggable="false"
    />

    {/* Very light overlay — keeps photo clearly visible */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#020b19]/10 via-transparent to-[#020b19]/20 pointer-events-none" />

    {/* Small slideshow indicator */}
    <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 backdrop-blur-md">

      {loginBackgrounds.map((_, index) => (
        <span
          key={index}
          className={`h-2 rounded-full transition-all duration-500 ${
            index === currentBg
              ? 'w-7 bg-cyan-400'
              : 'w-2 bg-white/40'
          }`}
        />
      ))}

    </div>

  </div>

</div>


          {/* ───────────────── FOOTER ───────────────── */}
          <div className="absolute bottom-7 left-10">

            <div className="mb-4 h-px w-14 bg-cyan-400/80" />

            <p className="text-[10px] font-medium tracking-[0.28em] text-blue-200/65">
              POWERED BY AI&nbsp;&nbsp; | &nbsp;&nbsp;BUILT FOR A SMARTER TOMORROW
            </p>

          </div>

        </div>
      </div>


      {/* =========================================================
          RIGHT — AUTHENTICATION
      ========================================================= */}
      <div
        className="flex flex-1 md:w-[38%] min-h-screen items-center justify-center px-4 py-7 md:px-7"
        style={{
          background:
            'linear-gradient(135deg,#e8f1ff 0%,#f8fbff 50%,#eaf4ff 100%)'
        }}
      >

        <div className="w-full max-w-[500px] rounded-[28px] border border-white bg-white px-8 py-8 shadow-[0_30px_90px_rgba(30,64,175,0.18)] md:px-9 md:py-8">


          {/* HEADER */}
          <div className="mb-6 text-center">

            <div
              className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] shadow-xl shadow-blue-500/25"
              style={{
                background:
                  'linear-gradient(135deg,#2563eb,#1d4ed8)'
              }}
            >
              <svg
                className="h-9 w-9 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>

            <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
              PayRecover AI
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-400">
              Revenue Recovery Platform
            </p>

          </div>


          {/* SIGNUP / SIGNIN TABS */}
          <div className="mb-6 flex rounded-xl bg-slate-100 p-1">

            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all duration-200 ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Create Account
            </button>

            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 rounded-lg py-3 text-sm font-bold transition-all duration-200 ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Sign In
            </button>

          </div>


          {/* LOCK MESSAGE */}
          {mode === 'signin' && isLocked && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">

              <div className="flex items-center gap-3">

                <Lock className="h-5 w-5 text-red-600" />

                <div>

                  <p className="text-sm font-bold text-red-700">
                    Account locked for security.
                  </p>

                  <p className="text-sm text-red-600">
                    Try again in{' '}
                    <span className="font-mono font-bold">
                      {formatCountdown(secondsLeft)}
                    </span>
                  </p>

                </div>

              </div>

            </div>
          )}


          {/* UNLOCKED MESSAGE */}
          {mode === 'signin' && justUnlocked && !isLocked && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">

              <UnlockKeyhole className="h-5 w-5 text-emerald-600" />

              <p className="text-sm font-medium text-emerald-700">
                Your account is unlocked. You can sign in now.
              </p>

            </div>
          )}


          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">


            {/* SHOP OWNER */}
            {mode === 'signup' && (
              <>
                <div>

                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    Shop Owner Name
                  </label>

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      ♙
                    </span>

                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Enter your name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                </div>


                {/* BUSINESS NAME */}
                <div>

                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    Shop / Business Name
                  </label>

                  <div className="relative">

                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      ▣
                    </span>

                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      placeholder="Enter business name"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />

                  </div>

                </div>
              </>
            )}


            {/* EMAIL */}
            <div>

              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                Email Address
              </label>

              <div className="relative">

                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  ✉
                </span>

                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

              </div>

            </div>


            {/* PASSWORD */}
            <div>

              <label className="mb-1.5 block text-sm font-bold text-slate-700">
                Password
              </label>

              <div className="relative">

                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  🔒
                </span>

                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={
                    mode === 'signup'
                      ? 'Create a strong password'
                      : 'Enter your password'
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />

              </div>


              {/* PASSWORD RULES */}
              {mode === 'signup' && password.length > 0 && (
                <ul className="mt-3 space-y-1.5 px-2">

                  {ruleResults.map((r) => (
                    <PasswordRuleItem
                      key={r.id}
                      satisfied={r.satisfied}
                      label={r.label}
                    />
                  ))}

                </ul>
              )}

            </div>


            {/* SUBMIT */}
            <button
              type="submit"
              disabled={submitDisabled}
              className="mt-2 flex w-full items-center justify-center gap-3 rounded-xl py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: submitDisabled
                  ? '#94a3b8'
                  : 'linear-gradient(135deg,#2563eb,#1d4ed8)'
              }}
            >

              {loading
                ? 'Please wait…'
                : mode === 'signup'
                  ? <>Create Account <span className="text-lg">→</span></>
                  : <>Sign In <span className="text-lg">→</span></>
              }

            </button>

          </form>


          {/* FORGOT PASSWORD */}
          {mode === 'signin' && (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="mt-4 w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              Forgot Password?
            </button>
          )}


          {/* SWITCH MODE */}
          <p className="mt-5 text-center text-xs text-slate-400">

            {mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="font-bold text-blue-600 hover:underline"
                >
                  Create Account
                </button>
              </>
            )}

          </p>


          {/* GENERAL MESSAGE */}
          {message &&
            !(mode === 'signin' && (isLocked || justUnlocked)) && (
              <div
                className={`mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
                  message.toLowerCase().includes('success') ||
                  message.toLowerCase().includes('sent')
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >

                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />

                <span>{message}</span>

              </div>
            )}

        </div>
      </div>

    </div>
  )
}