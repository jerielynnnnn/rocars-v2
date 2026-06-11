

// hooks/useAccessibilitySettings.js
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useAccessibilitySettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      setSettings(data || {
        accessibility_mode: false,
        voice_navigation: false,
        text_to_speech: false,
        high_contrast: false,
        large_text: false,
        reduced_motion: false,
        focus_indicators: true,
        screen_reader_optimized: false
      });
    }
    
    setLoading(false);
  };

  const updateSetting = async (key, value) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updated = { ...settings, [key]: value };
    setSettings(updated);

    await supabase
      .from('user_settings')
      .upsert({ 
        user_id: user.id, 
        [key]: value,
        updated_at: new Date()
      });
  };

  return { settings, loading, updateSetting };
}