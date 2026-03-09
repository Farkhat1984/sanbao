/**
 * Settings screen — language, notifications, biometric lock, app preferences.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Globe, Bell, Moon, Fingerprint, Info } from 'lucide-react'
import { cn } from '@sanbao/shared/utils'
import {
  checkBiometricAvailability,
  isBiometricEnabled,
  setBiometricEnabled,
  getBiometricLabel,
} from '@/lib/biometrics'

interface SettingToggle {
  id: string;
  icon: typeof Globe;
  label: string;
  description: string;
  enabled: boolean;
}

export default function SettingsScreen() {
  const navigate = useNavigate()

  const [settings, setSettings] = useState<SettingToggle[]>([
    {
      id: 'notifications',
      icon: Bell,
      label: 'Уведомления',
      description: 'Push-уведомления о новых сообщениях',
      enabled: true,
    },
    {
      id: 'darkMode',
      icon: Moon,
      label: 'Тёмная тема',
      description: 'Всегда использовать тёмную тему',
      enabled: true,
    },
  ])

  /* Biometric state — separate from generic toggles */
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'iris' | null>(null)
  const [biometricOn, setBiometricOn] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    async function init() {
      const [availability, enabled] = await Promise.all([
        checkBiometricAvailability(),
        isBiometricEnabled(),
      ])
      if (!mounted) return
      setBiometricAvailable(availability.available)
      setBiometricType(availability.type)
      setBiometricOn(enabled)
    }

    init()
    return () => { mounted = false }
  }, [])

  function toggleSetting(id: string) {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    )
  }

  async function handleBiometricToggle() {
    if (biometricLoading) return
    setBiometricLoading(true)

    try {
      const newValue = !biometricOn
      const success = await setBiometricEnabled(newValue)
      if (success) {
        setBiometricOn(newValue)
      }
    } finally {
      setBiometricLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header
        className={cn(
          'flex items-center gap-3 px-3 py-2.5',
          'border-b border-[var(--border)]',
          'bg-[var(--bg-secondary)]',
        )}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full active:bg-[var(--surface-hover)]"
          aria-label="Назад"
        >
          <ArrowLeft size={20} className="text-[var(--text-primary)]" />
        </button>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Настройки
        </h2>
      </header>

      <div className="scroll-container flex-1 px-4 py-4">
        {/* Language */}
        <section className="mb-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Язык
          </h3>
          <div
            className={cn(
              'flex items-center gap-3.5 rounded-2xl',
              'border border-[var(--border)] bg-[var(--bg-secondary)]',
              'px-4 py-3.5',
            )}
          >
            <Globe size={18} className="shrink-0 text-[var(--text-secondary)]" />
            <div className="flex-1">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Русский
              </span>
              <p className="text-xs text-[var(--text-muted)]">
                Язык интерфейса
              </p>
            </div>
          </div>
        </section>

        {/* Toggles */}
        <section className="mb-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Настройки приложения
          </h3>
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]">
            {settings.map((setting, i) => {
              const Icon = setting.icon
              return (
                <div
                  key={setting.id}
                  className={cn(
                    'flex items-center gap-3.5 px-4 py-3.5',
                    i < settings.length - 1 && 'border-b border-[var(--border)]',
                  )}
                >
                  <Icon size={18} className="shrink-0 text-[var(--text-secondary)]" />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {setting.label}
                    </span>
                    <p className="text-xs text-[var(--text-muted)]">
                      {setting.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={setting.enabled}
                    onClick={() => toggleSetting(setting.id)}
                    className={cn(
                      'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                      setting.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform shadow-sm',
                        setting.enabled ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Biometric Lock — only shown if hardware is available */}
        {biometricAvailable && (
          <section className="mb-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Безопасность
            </h3>
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-3.5 px-4 py-3.5">
                <Fingerprint size={18} className="shrink-0 text-[var(--text-secondary)]" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    Биометрическая блокировка
                  </span>
                  <p className="text-xs text-[var(--text-muted)]">
                    {getBiometricLabel(biometricType)} при возврате в приложение
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={biometricOn}
                  aria-label="Биометрическая блокировка"
                  disabled={biometricLoading}
                  onClick={handleBiometricToggle}
                  className={cn(
                    'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                    biometricOn ? 'bg-[var(--accent)]' : 'bg-[var(--border)]',
                    biometricLoading && 'opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform shadow-sm',
                      biometricOn ? 'left-[22px]' : 'left-0.5',
                    )}
                  />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* About */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            О приложении
          </h3>
          <div
            className={cn(
              'flex items-center gap-3.5 rounded-2xl',
              'border border-[var(--border)] bg-[var(--bg-secondary)]',
              'px-4 py-3.5',
            )}
          >
            <Info size={18} className="shrink-0 text-[var(--text-secondary)]" />
            <div className="flex-1">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Sanbao AI
              </span>
              <p className="text-xs text-[var(--text-muted)]">
                Версия 0.1.0
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
