'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useTranslation } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@homehub/ui/components/card';
import { Input } from '@homehub/ui/components/input';
import { Button } from '@homehub/ui/components/button';
import { AlertCircle, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslation();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const callbackUrl = searchParams.get('callbackUrl') || '/es/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast({
          variant: 'destructive',
          title: t('errors.unauthorized'),
          description: result.error,
        });
        return;
      }

      // Fetch user data to store in auth store
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const userData = await response.json();
        if (userData.success) {
          setAuth({
            user: userData.data.user,
            family: userData.data.family,
            accessToken: localStorage.getItem('accessToken') || '',
            refreshToken: localStorage.getItem('refreshToken') || '',
          });
        }
      }

      toast({
        title: t('auth.welcomeBack'),
        description: `${t('auth.welcomeBack')}, ${userData.data?.user?.name || ''}!`,
      });

      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errors.serverError'),
        description: t('errors.networkError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Mail className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{t('auth.welcomeBack')}</CardTitle>
          <CardDescription>{t('auth.login')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('email')}
              type="email"
              label={t('auth.email')}
              placeholder="tu@email.com"
              error={errors.email?.message}
              disabled={isLoading}
              autoComplete="email"
            />
            <div className="relative">
              <Input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                label={t('auth.password')}
                placeholder="••••••••"
                error={errors.password?.message}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-[38px] text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            {errors.form && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.form.message}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('auth.login')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>{t('auth.noAccount')}</p>
            <Link href="/es/register" className="text-primary hover:underline ml-1">
              {t('auth.createAccount')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}