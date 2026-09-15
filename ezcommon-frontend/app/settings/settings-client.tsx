"use client"
import { AppLayout } from '@/components/layout/app-layout'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Bell, Shield, Globe, HardDrive, Bot, Info, Mail, Lock, Download, Trash2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/lib/i18n/use-t'
import { useLocale } from '@/lib/i18n/locale-context'

export function SettingsClient() {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const { data: session } = useSession()
  const userEmail = session?.user?.email || ''
  const userName = session?.user?.name || t('settings.fullName')

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('settings.blurb')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Account Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {t('settings.account')}
              </CardTitle>
              <CardDescription>
                {t('settings.accountBlurb')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('settings.fullName')}</p>
                      <p className="text-sm text-muted-foreground">{userName}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('settings.email')}</p>
                      <p className="text-sm text-muted-foreground">{userEmail}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('settings.password')}</p>
                      <p className="text-sm text-muted-foreground">••••••••</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                {t('settings.quickActions')}
              </CardTitle>
              <CardDescription>
                {t('settings.quickActionsBlurb')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" size="lg">
                <Download className="h-4 w-4 mr-2" />
                {t('settings.exportData')}
              </Button>
              <Button variant="outline" className="w-full justify-start" size="lg">
                <HardDrive className="h-4 w-4 mr-2" />
                {t('settings.manageStorage')}
              </Button>
              <Button variant="destructive" className="w-full justify-start" size="lg">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('settings.deleteAccount')}
              </Button>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                {t('settings.notifications')}
              </CardTitle>
              <CardDescription>
                {t('settings.notificationsBlurb')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('settings.emailNotifications')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.emailNotificationsBlurb')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('settings.applicationUpdates')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.applicationUpdatesBlurb')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('settings.fileNotifications')}</p>
                  <p className="text-xs text-muted-foreground">{t('settings.fileNotificationsBlurb')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Storage Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-primary" />
                {t('settings.storage')}
              </CardTitle>
              <CardDescription>
                {t('settings.storageBlurb')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('settings.storageUsed')}</span>
                  <span className="font-medium">0 MB / 1 GB</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div className="bg-gradient-to-r from-primary to-primary/60 h-3 rounded-full transition-all" style={{ width: '0%' }}></div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t('settings.documents')}</p>
                    <p className="text-sm font-medium">{t('settings.fileCount').replace('{n}', '0')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{t('settings.totalSize')}</p>
                    <p className="text-sm font-medium">0 MB</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Preferences */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                {t('settings.preferences')}
              </CardTitle>
              <CardDescription>
                {t('settings.preferencesBlurb')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{t('settings.language')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.languageBlurb')}</p>
                    </div>
                  </div>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as 'en' | 'zh')}
                    className="w-full p-2 rounded-md border bg-background"
                  >
                    <option value="en">English (US)</option>
                    <option value="zh">中文 (简体)</option>
                  </select>
                </div>

                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{t('settings.timeZone')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.timeZoneBlurb')}</p>
                    </div>
                  </div>
                  <select defaultValue="eastern" className="w-full p-2 rounded-md border bg-background">
                    <option value="eastern">{t('settings.tzEastern')}</option>
                    <option value="pacific">{t('settings.tzPacific')}</option>
                    <option value="beijing">{t('settings.tzBeijing')}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Assistant Settings */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                {t('settings.ai')}
              </CardTitle>
              <CardDescription>
                {t('settings.aiBlurb')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('settings.autofill')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.autofillBlurb')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-lg border space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('settings.suggestionLevel')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.suggestionLevelBlurb')}</p>
                  </div>
                  <select
                    defaultValue="Balanced"
                    className="w-full p-2 rounded-md border bg-background text-sm"
                  >
                    <option value="Conservative">{t('settings.conservative')}</option>
                    <option value="Balanced">{t('settings.balanced')}</option>
                    <option value="Aggressive">{t('settings.aggressive')}</option>
                  </select>
                </div>

                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('settings.smartReview')}</p>
                      <p className="text-xs text-muted-foreground">{t('settings.smartReviewBlurb')}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card className="lg:col-span-3 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                {t('settings.about')}
              </CardTitle>
              <CardDescription>
                {t('settings.aboutBlurb')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Info className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{t('settings.version')}</p>
                  <p className="text-sm text-muted-foreground">1.0.0</p>
                </div>
                <div className="space-y-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Globe className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{t('settings.lastUpdated')}</p>
                  <p className="text-sm text-muted-foreground">Nov 7, 2025</p>
                </div>
                <div className="space-y-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{t('settings.documentation')}</p>
                  <a href="/policy" className="text-sm text-primary hover:underline">
                    {t('settings.privacyPolicy')}
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

