
// hooks/useVoiceNavigation.js

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

export function useVoiceNavigation(enabled) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const autoStarted = useRef(false);

  const speakFeedback = useCallback((message) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const feedback = new SpeechSynthesisUtterance(message);
    feedback.rate = 0.9;
    window.speechSynthesis.speak(feedback);
  }, []);

  const setSearchValue = useCallback((query) => {
    const searchInput = document.querySelector('[data-voice-search], input[type="search"], input[placeholder*="Search" i]');
    if (!searchInput) {
      speakFeedback('I could not find a search box on this page.');
      return;
    }

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(searchInput, query);
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    searchInput.focus();
  }, [speakFeedback]);

  const clickFirstMatch = useCallback((selector, fallbackMessage) => {
    const target = document.querySelector(selector);
    if (target) {
      target.click();
    } else {
      speakFeedback(fallbackMessage);
    }
  }, [speakFeedback]);

  const startReadingPage = useCallback(() => {
    const speech = new SpeechSynthesisUtterance();
    const mainContent = document.querySelector('main') || document.body;
    const text = mainContent.innerText.slice(0, 2000);
    
    speech.text = text;
    speech.rate = 0.9;
    speech.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  }, []);

  const stopReading = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  // Voice commands mapping
  const voiceCommands = useMemo(() => ({
    'go to home': () => window.location.href = '/',
    'go to products': () => window.location.href = '/products',
    'go to cart': () => window.location.href = '/cart',
    'go to profile': () => window.location.href = '/profile',
    'go to orders': () => window.location.href = '/orders',
    'go to dashboard': () => window.location.href = '/admin/dashboard',
    'go to admin products': () => window.location.href = '/admin/products',
    'go to admin orders': () => window.location.href = '/admin/orders',
    'search for': (query) => setSearchValue(query),
    'search': (query) => setSearchValue(query),
    'add to cart': () => {
      clickFirstMatch('[data-action="add-to-cart"], button[aria-label*="Add" i], button', 'I could not find an add to cart button.');
    },
    'checkout': () => window.location.href = '/checkout',
    'scroll down': () => window.scrollBy({ top: 500, behavior: 'smooth' }),
    'scroll up': () => window.scrollBy({ top: -500, behavior: 'smooth' }),
    'go to top': () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    'read page': () => startReadingPage(),
    'stop reading': () => stopReading(),
    'open accessibility': () => window.dispatchEvent(new Event('rocars-open-accessibility')),
    'close accessibility': () => window.dispatchEvent(new Event('rocars-close-accessibility')),
    'back': () => window.history.back(),
    'next page': () => {
      const nextBtn = document.querySelector('[aria-label="Next page"]');
      nextBtn?.click();
    },
    'previous page': () => {
      const prevBtn = document.querySelector('[aria-label="Previous page"]');
      prevBtn?.click();
    }
  }), [clickFirstMatch, setSearchValue, startReadingPage, stopReading]);

  useEffect(() => {
    if (!enabled || !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognition();
    
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = 'en-US';

    recognitionInstance.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      
      for (const [command, action] of Object.entries(voiceCommands)) {
        if (transcript === command || transcript.startsWith(`${command} `) || transcript.includes(command)) {
          if (typeof action === 'function') {
            // Extract query for search commands
            if (command === 'search for' || command === 'search') {
              const query = transcript.replace(command, '').trim();
              action(query);
            } else {
              action();
            }
          }
          
          // Provide voice feedback
          speakFeedback(`Executing ${command}`);
          break;
        }
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      setIsListening(false);
    };

    recognitionInstance.onstart = () => {
      setIsListening(true);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognitionInstance;

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      recognitionRef.current = null;
    };
  }, [enabled, speakFeedback, voiceCommands]);

  useEffect(() => {
    if (!enabled) {
      autoStarted.current = false;
      return;
    }

    if (!recognitionRef.current || isListening || autoStarted.current) return;

    try {
      recognitionRef.current.start();
      autoStarted.current = true;
    } catch {
      autoStarted.current = false;
    }
  }, [enabled, isListening]);

  const startListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {
        return;
      }
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return { isListening, startListening, stopListening };
}
