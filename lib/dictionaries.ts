import 'server-only'
import { Dictionary } from '@/types/dictionary'

export type Locale = 'en' | 'it'

const dictionaries = {
  en: () => import('../dictionaries/en.json').then((module) => module.default as Dictionary),
  it: () => import('../dictionaries/it.json').then((module) => module.default as Dictionary),
}

export const getDictionary = async (locale: Locale): Promise<Dictionary> => {
  return dictionaries[locale]?.() ?? dictionaries.en()
}