'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from './ui/button'
import { setLocale } from '@/lib/utils'

export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('languageSwitcher')
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setLocale(locale)
  }, [locale])

  const languages = [
    { code: 'en', label: t('en') },
    { code: 'fr', label: t('fr') },
    { code: 'es', label: t('es') },
    { code: 'pt', label: t('pt') },
  ]

  const handleLanguageChange = (newLocale: string) => {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPathname)
  }

  return (
    <div className="flex gap-2">
      {languages.map(lang => (
        <Button
          key={lang.code}
          variant={locale === lang.code ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleLanguageChange(lang.code)}
        >
          {lang.label}
        </Button>
      ))}
    </div>
  )
}
