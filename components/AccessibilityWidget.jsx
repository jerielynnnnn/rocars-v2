'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Accessibility,
  Circle,
  Eye,
  Moon,
  MoveRight,
  RefreshCcw,
  Sparkles,
  Type,
  Volume2,
  X,
  Mic,
  MicOff,
} from 'lucide-react';
import { useVoiceNavigation } from '@/hooks/useVoicenavigation';

const TEXT_SIZES = {
  small: '14px',
  default: '16px',
  large: '18px',
  xlarge: '20px',
};

const getSavedSetting = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) || fallback;
};

const getSavedTextSize = () => {
  const savedSize = getSavedSetting('rocars_a11y_fontSize', '17px');
  return Object.entries(TEXT_SIZES).find(([, value]) => value === savedSize)?.[0] || 'default';
};

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [textSize, setTextSize] = useState(getSavedTextSize);
  const [contrastMode, setContrastMode] = useState(() => getSavedSetting('rocars_a11y_contrast', 'default'));
  const [reduceMotion, setReduceMotion] = useState(() => getSavedSetting('rocars_a11y_reduceMotion', 'false') === 'true');
  const [lineHeight, setLineHeight] = useState(() => getSavedSetting('rocars_a11y_lineHeight', 'normal'));
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => getSavedSetting('rocars_a11y_voice', 'false') === 'true');
  const voiceSupported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const { isListening, startListening, stopListening } = useVoiceNavigation(voiceEnabled);

  useEffect(() => {
    const body = document.body;
    const root = document.documentElement;

    root.style.fontSize = TEXT_SIZES[textSize] || '16px';
    body.style.lineHeight = lineHeight === 'normal' ? '1.6' : '1.9';
    body.classList.remove('a11y-text-small', 'a11y-text-default', 'a11y-text-large', 'a11y-text-xlarge');
    body.classList.add(`a11y-text-${textSize}`);
    body.classList.toggle('reduce-motion', reduceMotion);
    body.classList.toggle('high-contrast', contrastMode === 'high');
    body.classList.toggle('yellow-mode', contrastMode === 'yellow');
    body.classList.toggle('dark-mode', contrastMode === 'dark');
    body.classList.toggle('spacious-reading', lineHeight === 'spacious');

    localStorage.setItem('rocars_a11y_fontSize', TEXT_SIZES[textSize] || '16px');
    localStorage.setItem('rocars_a11y_contrast', contrastMode);
    localStorage.setItem('rocars_a11y_reduceMotion', String(reduceMotion));
    localStorage.setItem('rocars_a11y_lineHeight', lineHeight);
  }, [textSize, contrastMode, reduceMotion, lineHeight]);

  useEffect(() => {
    localStorage.setItem('rocars_a11y_voice', String(voiceEnabled));

    if (!voiceEnabled && isListening) {
      stopListening();
    }
  }, [voiceEnabled, isListening, stopListening]);

  const handleReadPage = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const text = document.body.innerText
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    const utterance = new SpeechSynthesisUtterance(text || 'Welcome to ROCARS accessibility mode.');
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleReset = () => {
    setTextSize('default');
    setContrastMode('default');
    setReduceMotion(false);
    setLineHeight('normal');
    setVoiceEnabled(false);
    stopListening();
    document.documentElement.style.fontSize = '16px';
    document.body.style.lineHeight = '1.6';
    document.body.classList.remove(
      'a11y-text-small',
      'a11y-text-default',
      'a11y-text-large',
      'a11y-text-xlarge',
      'reduce-motion',
      'high-contrast',
      'yellow-mode',
      'dark-mode',
      'spacious-reading'
    );
    localStorage.removeItem('rocars_a11y_fontSize');
    localStorage.removeItem('rocars_a11y_contrast');
    localStorage.removeItem('rocars_a11y_reduceMotion');
    localStorage.removeItem('rocars_a11y_lineHeight');
    localStorage.removeItem('rocars_a11y_voice');
  };

  const quickBadges = useMemo(() => {
    return [
      { label: 'Text: ' + textSize, tone: 'bg-amber-100 text-amber-900' },
      { label: contrastMode === 'default' ? 'Standard mode' : contrastMode + ' mode', tone: 'bg-black text-white' },
      { label: reduceMotion ? 'Motion reduced' : 'Motion on', tone: 'bg-emerald-100 text-emerald-900' },
      { label: voiceEnabled ? 'Voice ready' : 'Voice off', tone: 'bg-blue-100 text-blue-900' },
    ];
  }, [textSize, contrastMode, reduceMotion, voiceEnabled]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    const closePanel = () => {
      setOpen(false);
      setHoverOpen(false);
    };

    window.addEventListener('rocars-open-accessibility', openPanel);
    window.addEventListener('rocars-close-accessibility', closePanel);

    return () => {
      window.removeEventListener('rocars-open-accessibility', openPanel);
      window.removeEventListener('rocars-close-accessibility', closePanel);
    };
  }, []);

  const toggleVoice = () => {
    if (!voiceSupported) {
      return;
    }

    if (!voiceEnabled) {
      setVoiceEnabled(true);
      setTimeout(() => startListening(), 100);
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const panelOpen = open || hoverOpen;

  return (
    <div
      className="pointer-events-none fixed bottom-24 right-3 z-[99999] flex flex-col items-end gap-3"
      onMouseEnter={() => setHoverOpen(true)}
      onMouseLeave={() => setHoverOpen(false)}
      onFocus={() => setHoverOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setHoverOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={panelOpen}
        aria-label="Open accessibility options"
        className="pointer-events-auto group flex h-12 items-center gap-2 overflow-hidden rounded-full border border-black/10 bg-linear-to-r from-amber-300 via-yellow-300 to-amber-400 px-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.16)] transition duration-200 hover:-translate-y-0.5 hover:border-black hover:bg-linear-to-r hover:from-black hover:via-black hover:to-zinc-800 hover:text-amber-200 focus:outline-none focus:ring-4 focus:ring-amber-200"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-amber-300 shadow-inner transition group-hover:bg-amber-300 group-hover:text-black">
          <Accessibility className="h-5 w-5" />
        </span>
        <span className="max-w-0 whitespace-nowrap text-sm font-semibold tracking-wide text-black opacity-0 transition-all duration-200 group-hover:max-w-32 group-hover:opacity-100 group-focus-visible:max-w-32 group-focus-visible:opacity-100 md:block group-hover:text-amber-100">
          Accessibility
        </span>
        <Circle className="hidden h-4 w-4 text-black group-hover:text-amber-100 md:block" />
      </button>

      {panelOpen && (
        <aside className="pointer-events-auto flex max-h-[calc(100vh-7rem)] w-90 max-w-[calc(100vw-1rem)] flex-col rounded-3xl border border-black/10 bg-white/95 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="overflow-y-auto p-4">
          <div className="mb-4 flex items-start justify-between gap-3 border-b border-amber-200 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-amber-600">ROCARS</p>
              <h3 className="text-xl font-semibold text-black">Accessibility Center</h3>
              <p className="text-sm text-gray-600"></p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setHoverOpen(false);
              }}
              aria-label="Close accessibility panel"
              className="rounded-full border border-gray-200 p-2 text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {quickBadges.map((item) => (
              <span key={item.label} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.tone}`}>
                {item.label}
              </span>
            ))}
          </div>

          <section className="space-y-4">
            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-black"><Type className="h-4 w-4 text-amber-500" /> Text size</div>
                <span className="text-xs text-gray-500">Choose a reading size</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TEXT_SIZES).map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTextSize(key)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${textSize === key ? 'border-amber-400 bg-amber-100 text-black' : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50'}`}
                  >
                    {key === 'default' ? 'Default' : key === 'xlarge' ? 'XL' : key.charAt(0).toUpperCase() + key.slice(1)}
                    <span className="ml-1 text-[11px] text-gray-500">({value})</span>
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-black"><Eye className="h-4 w-4 text-amber-500" /> Visual mode</div>
                <span className="text-xs text-gray-500">Improved contrast options</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['default', 'Standard'],
                  ['high', 'High contrast'],
                  ['yellow', 'Yellow mode'],
                  ['dark', 'Dark mode'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setContrastMode(mode)}
                    className={`rounded-xl border px-3 py-2 text-sm text-left font-medium transition ${contrastMode === mode ? 'border-amber-400 bg-amber-100 text-black' : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-black"><Sparkles className="h-4 w-4 text-amber-500" /> Quick actions</div>
                <span className="text-xs text-gray-500">Fast tools for browsing</span>
              </div>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={handleReadPage}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 hover:border-amber-300 hover:bg-amber-50"
                >
                  <span className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-amber-500" /> Read this page aloud</span>
                  {isSpeaking ? <span className="text-xs text-amber-700">Reading</span> : <MoveRight className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setReduceMotion((v) => !v)}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition ${reduceMotion ? 'border-amber-400 bg-amber-100 text-black' : 'border-gray-200 bg-white text-gray-800 hover:border-amber-300 hover:bg-amber-50'}`}
                >
                  <span className="flex items-center gap-2"><Moon className="h-4 w-4 text-amber-500" /> Reduce motion</span>
                  <span className="text-xs text-gray-500">{reduceMotion ? 'On' : 'Off'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLineHeight((v) => (v === 'normal' ? 'spacious' : 'normal'))}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition ${lineHeight === 'spacious' ? 'border-amber-400 bg-amber-100 text-black' : 'border-gray-200 bg-white text-gray-800 hover:border-amber-300 hover:bg-amber-50'}`}
                >
                  <span className="flex items-center gap-2"><Eye className="h-4 w-4 text-amber-500" /> Reading spacing</span>
                  <span className="text-xs text-gray-500">{lineHeight === 'spacious' ? 'Spacious' : 'Normal'}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={!voiceSupported}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium transition ${voiceEnabled && isListening ? 'border-blue-400 bg-blue-100 text-black' : 'border-gray-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-blue-50'} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="flex items-center gap-2">
                    {voiceEnabled && isListening ? <Mic className="h-4 w-4 text-blue-500" /> : <MicOff className="h-4 w-4 text-blue-500" />}
                    Voice commands
                  </span>
                  <span className="text-xs text-gray-500">
                    {!voiceSupported ? 'Unsupported' : voiceEnabled && isListening ? 'Listening' : 'Start'}
                  </span>
                </button>
              </div>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-black"><RefreshCcw className="h-4 w-4 text-amber-500" /> Reset</div>
                <span className="text-xs text-gray-500">Restore defaults</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-xl border border-black bg-black px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400 hover:text-black"
              >
                Reset all accessibility settings
              </button>
            </article>
          </section>

          <p className="mt-3 text-xs text-gray-500">Tip: press Ctrl + Shift + A. Try saying “go to products”, “search brake pads”, “scroll down”, or “read page”.</p>
          </div>
        </aside>
      )}
    </div>
  );
}
