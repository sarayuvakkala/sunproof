import type { Lang } from '../../hi'

// "Today" is fixed when the page loads. Every date on the installer screens is an offset from it.
const BASE = new Date()
export const dOff = (o: number) => new Date(BASE.getFullYear(), BASE.getMonth(), BASE.getDate() + o)

export const WD: Record<Lang, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  hi: ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'],
}
export const MO: Record<Lang, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  hi: ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'],
}
export const MON: Record<Lang, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  hi: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
}

export const fd = (o: number, lang: Lang) => { const d = dOff(o); return `${WD[lang][d.getDay()]} ${d.getDate()} ${MO[lang][d.getMonth()]}` }
export const dm = (o: number, lang: Lang) => { const d = dOff(o); return `${d.getDate()} ${MO[lang][d.getMonth()]}` }
export const rel = (o: number, lang: Lang) => (o === 0 ? (lang === 'hi' ? 'आज' : 'Today') : o === 1 ? (lang === 'hi' ? 'कल' : 'Tomorrow') : fd(o, lang))

export const FWD: Record<Lang, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  hi: ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
}
export const vAm = (t: string) => { const [h, m] = t.split(':'); const n = +h; return `${n % 12 || 12}${m === '00' ? '' : `:${m}`} ${n < 12 ? 'am' : 'pm'}` }

const pad = (n: number) => String(n).padStart(2, '0')
/** YYYY-MM-DD for the day `o` days from today (local time). */
export const isoOf = (o: number) => { const d = dOff(o); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
/** Whole days from today to a YYYY-MM-DD date or an ISO timestamp (negative for the past). */
export const offOf = (iso: string) => {
  const d = new Date(iso.length > 10 ? iso : `${iso}T00:00:00`)
  return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - dOff(0).getTime()) / 86400000)
}
export const fmtIso = (iso: string, lang: Lang) => { const d = new Date(`${iso.slice(0, 10)}T00:00:00`); return `${d.getDate()} ${MO[lang][d.getMonth()]}` }
