"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { api, ApiError } from "@/lib/api-client"

import { type LinkStatsResponse } from "@shortener/shared"

import Link from "next/link"
import Image from "next/image"

import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Page = () => {
  const { id } = useParams<{ id: string }>()
  
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<LinkStatsResponse | null>(null)

  const src = `/api/links/${id}/qr`;

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
        try {

        } catch (err) {

        } finally {
        }
    }

    load();
    return () => controller.abort();
  }, []);

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
          <Card className="w-full max-w-6xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Stats and QR code</CardTitle>
            </CardHeader>

            <CardContent>
              <section className="flex flex-col gap-2">
                <Image
                  src={src}
                  alt="QR code for this link"
                  width={256}
                  height={256}
                  className="rounded-md bg-white"
                  onError={() => setFailed(true)}
                  />

                  <div className="flex flex-row gap-2 justify-center">
                    <Button variant="outline" size="sm">
                      <a href={`${src}?format=png&size=1024&download=1`} download>
                        Download PNG
                      </a>
                    </Button>
                    
                    <Button variant="outline" size="sm">
                      <a href={`${src}?format=svg&download=1`} download>
                        Download SVG
                      </a>
                    </Button>
                  </div>
                </section>
                <section>

                </section>
              </CardContent>
            </Card>
        </main>
    </div>
  )
}

export default Page