import type { Shown } from './data'
import { useProApp } from './proCtx'

export function useStLabel() {
  const { L } = useProApp()
  return (s: Shown) => ({
    reply: L('Needs reply', 'जवाब चाहिए'), overdue: L('Overdue', 'देर हो गई'), visit: L('Visit booked', 'विज़िट तय'),
    check: L('Checking fix', 'जाँच जारी'), fixed: L('Fixed', 'ठीक हुआ'), closed: L('Closed', 'बंद'),
  })[s]
}

