"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, ApiError, fieldErrors } from "@/lib/api-client"
import { registerSchema } from '@shortener/shared';

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
    const parsed = registerSchema.safeParse({
      email: form.get('email'),
      username: form.get('username'),
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
      // 2) Cria a conta
      await api.post('/api/auth/register', parsed.data, { redirectOn401: false });

      await api.post(
        '/api/auth/login',
        { email: parsed.data.email, password: parsed.data.password },
        { redirectOn401: false },
      );

      router.push('/create');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: 'Email already registered' });
      } else if (err instanceof ApiError && err.status === 400) {
        setErrors(fieldErrors(err)); // validação do servidor, por campo
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Unexpected error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" autoComplete="username" type="text"/>
              {errors.username && <p className="text-sm text-red-600">{errors.username}</p>}
            </div>

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
              {loading ? 'Creating...' : 'Create account'}
            </Button>

            <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
              Already have an account?{' '}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

export default Page