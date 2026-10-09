import { useEffect, useState } from 'react'

export interface Weather { temp: number; icon: string; label: string; sub: string }

/** Current weather for Delhi from Open-Meteo (free, no key). Null when it can't be fetched. */
export function useWeather(): Weather | null {
  const [w, setW] = useState<Weather | null>(null)
  useEffect(() => {
    const ctl = new AbortController()
    fetch('https://api.open-meteo.com/v1/forecast?latitude=28.61&longitude=77.21&current=temperature_2m,weather_code,cloud_cover', { signal: ctl.signal })
      .then((r) => r.json())
      .then((j) => {
        const c = j.current as { temperature_2m: number; weather_code: number; cloud_cover: number }
        const code = c.weather_code
        let icon = '☀️', label = 'Sunny', sub = 'good sun'
        if (code >= 95) { icon = '⛈'; label = 'Storm'; sub = 'no sun' }
        else if (code >= 51) { icon = '🌧'; label = 'Rain'; sub = 'washes panels' }
        else if (code >= 45) { icon = '🌫'; label = 'Foggy'; sub = 'low sun' }
        else if (c.cloud_cover >= 70) { icon = '☁️'; label = 'Cloudy'; sub = 'less sun' }
        else if (c.cloud_cover >= 30) { icon = '⛅'; label = 'Partly cloudy'; sub = 'some sun' }
        setW({ temp: Math.round(c.temperature_2m), icon, label, sub })
      })
      .catch(() => {})
    return () => ctl.abort()
  }, [])
  return w
}
