import Link from 'next/link';
import { BarChart3, Clock, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black pt-12">
      <main className="flex w-full max-w-5xl flex-col items-center gap-12 px-6 py-16 pb-40">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Shorten links. Understand who clicks.
          </h1>
          <h2 className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Short links with expiration, QR codes, and analytics by day, country, device, and referral source.
          </h2>

          <div className="mt-4 flex gap-3">
            <Button size="lg" variant="outline">
              <Link href="/register">Create account</Link>
            </Button>
            <Button size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>

        <div className="grid w-full gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5" /> Know who clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Track each link&#39;s clicks by day, country, device, and referral source. See what
                works and where your audience comes from.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5" /> Links with expiration dates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Set an expiration date and the link will stop working automatically. Ideal for
                promotions, invitations, and temporary content.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-5" /> QR code in one click
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Every short link gets a QR code ready to download. Use it on posters, menus,
                business cards, or printed materials.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="flex flex-row justify-between w-full max-w-5xl text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-800 rounded-xl p-4">
        <h6>Made by: Athos Chaves Lopes de Almeida</h6>
        <h6>My GitHub profile: <a href="https://github.com/AthosChavesLopesdeAlmeida" className='underline'>Click here!</a></h6>
      </footer>
    </div>
  );
}