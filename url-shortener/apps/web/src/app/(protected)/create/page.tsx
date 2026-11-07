"use client"
import { useState } from "react"
import { api, ApiError, fieldErrors } from "@/lib/api-client"
import { createLinkSchema } from '@shortener/shared';
import { LinkResponse } from "@shortener/shared";

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Page = () => {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [created, setCreated] = useState<LinkResponse>()

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})
    setFormError(null)

    const form = new FormData(e.currentTarget)
    const parsed = createLinkSchema.safeParse({
      longUrl: form.get('longURL'),
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
      const link = await api.post<LinkResponse>('/api/links', parsed.data);
      setCreated(link)

    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        const byField = fieldErrors(err);
        // Sem issues (ex.: bloqueio do próprio domínio), a mensagem do servidor vai para o campo
        setErrors(Object.keys(byField).length > 0 ? byField : { longUrl: err.message });
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError('Too much attempts. Wait a moment and try again');
      } else if (err instanceof ApiError && err.status === 500) {
        setFormError('Not possible to create link now. Try again');
      } else {
        setFormError(err instanceof ApiError ? err.message : 'Unexpected error');
      }

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 items-center bg-background text-foreground gap-30">
        <header className="flex flex-row items-center justify-between w-full h-18 p-4 bg-[#171717]">
          <h1 className="text-4xl font-bold">Link Shortener</h1>

          <div className="flex flex-row gap-4">
            <Button size="lg" variant="outline">
              <Link href="/links">My links</Link>
            </Button>

            <Button size="lg" variant="outline">
              <Link href="/create">Create</Link>
            </Button>

            <Button size="lg" variant="outline">
              <Link href="/acc">My account</Link>
            </Button>
          </div>
        </header>

        <main>
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Shorten link</CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="longURL">Original link</Label>

                  <div>
                    <Input id="longURL" name="longURL" autoComplete="longURL" type="url" className="w-130 h-8 rounded-r-[0px]"/>
                    <Button size="lg" variant="outline" className="h-8 rounded-l-[0px]" type="submit" disabled={loading}>
                      {loading ? "Shortening..." : "Shorten"}
                    </Button>
                  </div>
                  
                  {errors.longURL && <p className="text-sm text-red-600">{errors.longURL}</p>}
                </div>

                {formError && <p className="text-sm text-red-600">{formError}</p>}
                {created && <p className="text-sm font-bold">Your link - {<a className="underline" href={created.shortUrl}>{created.shortUrl}</a>}</p>}
              </form>
            </CardContent>
          </Card>
        </main>
    </div>
  )
}

export default Page