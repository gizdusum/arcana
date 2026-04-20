'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Lang } from './i18n'

type AnyT = (typeof translations)['en'] | (typeof translations)['tr']

interface LangCtx {
  lang: Lang
  t: AnyT
  setLang: (l: Lang) => void
}

const Ctx = createContext<LangCtx>({
  lang: 'en',
  t: translations.en as AnyT,
  setLang: () => {},
})

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('arcana-lang') as Lang | null
    if (stored === 'en' || stored === 'tr') setLangState(stored)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('arcana-lang', l)
  }

  return (
    <Ctx.Provider value={{ lang, t: translations[lang] as AnyT, setLang }}>
      {children}
    </Ctx.Provider>
  )
}

export const useLang = () => useContext(Ctx)
