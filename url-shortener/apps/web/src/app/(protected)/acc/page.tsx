"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client"
import { deleteAccountSchema } from '@shortener/shared';

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogHeader, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Account = {
  id: string,
  username: string,
  email: string
}

const Page = () => {
  const router = useRouter()

  const [deleting, setDeleting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const [account, setAccount] = useState<Account | null>(null) 

  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await api.get<Account>('/api/auth/me', { signal: controller.signal });
        setAccount(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Unexpected error');
      }
    }

    load();
    return () => controller.abort();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true)
    setError(null)
    try {
      await api.post('/api/auth/logout', undefined, { redirectOn401: false })
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? 'No connection. Check your internet and try again'
          : 'Unable to log out now. Try again',
      );
      setLoggingOut(false);
    }
  }

  const handleOpenChange = (open: boolean) => {
    setIsFormOpen(open)
    if (!open) {
      setErrors({})
      setFormError(null)
    }
  }

  const handleDelete = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    setFormError(null)
    setError(null)
    setErrors({})

    const form = new FormData(e.currentTarget)
    const parsed = deleteAccountSchema.safeParse({
      password: form.get('password'),
    })

    if (!parsed.success) {
      setErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }

    setDeleting(true)

    try {
      await api.delete("/api/account", parsed.data)
      router.push("/register")
      router.refresh()
    } catch (err) { 
      if (err instanceof ApiError && err.status === 403) {
        setErrors({ password: 'Incorrect password' })
      } else if (err instanceof ApiError && err.status === 400) {
        setErrors({ password: 'Enter your password' })
      } else if (err instanceof ApiError && err.status === 429) {
        setFormError('Too many attempts. Wait a moment and try again')
      } else if (err instanceof ApiError && err.status === 0) {
        setFormError('No connection. Check your internet and try again')
      } else {
        setFormError('Unable to delete the account now. Try again')
      }
      setDeleting(false)
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
          <Card className="w-full min-w-[400px] max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">Your account</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2 text-center">
                <h1 className="text-m">Username: {account?.username}</h1>
                <h2 className="text-m">Email: {account?.email}</h2>
              </div>

              <div className="flex flex-row gap-2 justify-center">
                <Button variant={"outline"} disabled={loggingOut} onClick={() => handleLogout()}>
                  {loggingOut ? "Logging out..." : "Log out"}
                </Button>

                <Button variant={"destructive"} onClick={() => setIsFormOpen(true)}>
                  Delete account
                </Button>
              </div>

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            </CardContent>
          </Card>

          <Dialog open={isFormOpen} onOpenChange={handleOpenChange}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete account</DialogTitle>
                <DialogDescription>Deleting your account is an irreversible action. Insert your password to confirm</DialogDescription>
              </DialogHeader>

              <div>
                <form onSubmit={handleDelete} className="flex flex-col gap-4" noValidate>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" autoComplete="current-password" type="password"/>
    
                    {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
                    {formError && <p className="text-sm text-red-600">{formError}</p>}
 
                    <Button size="lg" variant="destructive" type="submit" disabled={deleting}>
                      {deleting ? "Deleting..." : "Delete account"}
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </main>
    </div>
  )
}

export default Page