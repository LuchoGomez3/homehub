'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@homehub/ui/components/card';
import { Input } from '@homehub/ui/components/input';
import { Button } from '@homehub/ui/components/button';
import { AlertCircle, Loader2, Mail, Lock, User, Users, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
  name: z.string().min(1, 'Nombre requerido'),
  familyName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslation();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', name: '', familyName: '' },
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const response = await api.register({
        email: data.email,
        password: data.password,
        name: data.name,
        familyName: data.familyName,
      });

      const { user, accessToken, refreshToken } = response.data;

      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      setAuth({
        user,
        family: { id: user.familyId, name: data.familyName || `${data.name}'s Family` },
        accessToken,
        refreshToken,
      });

      toast({
        title: t('success.created'),
        description: t('auth.createFamily'),
      });

      router.push('/es/dashboard');
      router.refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('errors.serverError'),
        description: error.message || t('errors.networkError'),
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
            <Users className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">{t('auth.createAccount')}</CardTitle>
          <CardDescription>{t('auth.createFamily')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              {...register('name')}
              type="text"
              label={t('auth.name')}
              placeholder="Tu nombre"
              error={errors.name?.message}
              disabled={isLoading}
              autoComplete="name"
            />
            <Input
              {...register('email')}
              type="email"
              label={t('auth.email')}
              placeholder="tu@email.com"
              error={errors.email?.message}
              disabled={isLoading}
              autoComplete="email"
            />
            <Input
              {...register('familyName')}
              type="text"
              label={t('auth.familyName')}
              placeholder="Familia García"
              error={errors.familyName?.message}
              disabled={isLoading}
            />
            <div className="relative">
              <Input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                label={t('auth.password')}
                placeholder="••••••••"
                error={errors.password?.message}
                disabled={isLoading}
                autoComplete="new-password"
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
            <div className="relative">
              <Input
                {...register('confirmPassword')}
                type={showPassword ? 'text' : 'password'}
                label={t('auth.confirmPassword')}
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                disabled={isLoading}
                autoComplete="new-password"
              />
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
                t('auth.register')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>{t('auth.hasAccount')}</p>
            <Link href="/es/login" className="text-primary hover:underline ml-1">
              {t('auth.login')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}