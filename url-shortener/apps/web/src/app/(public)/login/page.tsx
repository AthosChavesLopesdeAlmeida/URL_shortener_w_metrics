"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, ApiError, fieldErrors } from "@/lib/api-client"
import { loginSchema } from '@shortener/shared';

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


const Page = () => {
  const router = useRouter()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)

    const form = new FormData(e.currentTarget)
    const parsed = loginSchema.safeParse({
      email: form.get('email'),
      password: form.get('password')
    })

    // 1) Validação no cliente: erro imediato, sem ir à rede
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }

    setLoading(true)

    try {
      await api.post(
        '/api/auth/login',
        { email: parsed.data.email, password: parsed.data.password },
        { redirectOn401: false },
      );

      router.push('/create');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError('Incorrect email or incorrect password');
      } else if (err instanceof ApiError && err.status === 400) {
        setErrors(fieldErrors(err));
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError('To much attempts. Wait a moment and try again');
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Unexpected error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" autoComplete="email" type="email"/>
              {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" autoComplete="password" type="password"/>
              {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <Button type="submit" disabled={loading}>
              {loading ? 'Entering account...' : 'Sign in'}
            </Button>

            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Don&#39;t have an acccount?{' '}
              <Link href="/register" className="underline">
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Page