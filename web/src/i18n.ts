import type { Status } from './api'

export type Lang = 'hi' | 'en'

export const T = {
  hi: {
    tagline: 'आपके सोलर की स्वतंत्र जाँच',
    demo: 'डेमो घर: सार्वजनिक प्लांट डेटा से बना, असली घर नहीं',
    listen: 'हिंदी में सुनें',
    loadingVoice: 'आवाज़ तैयार हो रही है…',
    unitsLost: 'यूनिट कम बनीं',
    rupeesLost: 'रुपये का नुकसान',
    co2: 'किलो अतिरिक्त CO₂',
    chartTitle: 'हर दिन: कितनी बिजली बननी चाहिए थी, कितनी बनी',
    expected: 'उम्मीद की सीमा',
    actual: 'असल में बनी',
    kwh: 'यूनिट',
    assumptions: (tariff: number, co2: number) => `मान्यताएँ: ₹${tariff}/यूनिट, ${co2} किलो CO₂/यूनिट (CEA v22.0)`,
    loading: 'जाँच हो रही है…',
    error: 'अभी जानकारी नहीं मिल पाई। थोड़ी देर बाद फिर कोशिश करें।',
    period: 'अवधि',
  },
  en: {
    tagline: 'An independent check of your solar',
    demo: 'Demo household built from public plant data, not a real home',
    listen: 'Listen',
    loadingVoice: 'Preparing audio…',
    unitsLost: 'units lost',
    rupeesLost: 'lost',
    co2: 'kg extra CO₂',
    chartTitle: 'Each day: what your solar should have made, and what it made',
    expected: 'Expected range',
    actual: 'Actual',
    kwh: 'units',
    assumptions: (tariff: number, co2: number) => `Assumptions: ₹${tariff}/unit, ${co2} kg CO₂/unit (CEA v22.0)`,
    loading: 'Checking…',
    error: "Couldn't load your data right now. Please try again shortly.",
    period: 'Period',
  },
} as const

export const STATUS: Record<Status, { hi: string; en: string; tone: 'good' | 'warning' | 'serious' | 'critical'; icon: string }> = {
  ok: { hi: 'ठीक चल रहा है', en: 'Working as expected', tone: 'good', icon: '✓' },
  shortfall: { hi: 'जाँच करवाना ठीक रहेगा', en: 'Worth checking', tone: 'serious', icon: '!' },
  trip: { hi: 'सिस्टम बंद रहा', en: 'System stopped', tone: 'critical', icon: '■' },
  likely_dust: { hi: 'शायद धूल', en: 'Likely dust', tone: 'warning', icon: '~' },
  insufficient_data: { hi: 'और रीडिंग चाहिए', en: 'Need more readings', tone: 'warning', icon: '?' },
}

export const FLAG_LABEL = {
  trip: { hi: 'बंद', en: 'Stopped' },
  shortfall: { hi: 'कम', en: 'Low' },
  likely_dust: { hi: 'धूल?', en: 'Dust?' },
} as const
