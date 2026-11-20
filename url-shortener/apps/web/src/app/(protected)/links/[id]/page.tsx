"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { api, ApiError } from "@/lib/api-client"
import { type LinkStatsResponse, type LinkResponse } from "@shortener/shared"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Row = { label: string, clicks: number }

const TOP = 5

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Desktop",
  mobile: "Mobile",
  tablet: "Tablet",
  bot: "Bots & link previews",
  other: "Other",
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

// "BR" -> "Brazil"; sem país vira "Unknown". Código inválido não pode quebrar a página
const countryName = (code: string | null) => {
  if (!code) return "Unknown"
  try {
    return regionNames.of(code) ?? code
  } catch {
    return code
  }
}

const RankingCard = ({ title, rows, total }: { title: string, rows: Row[], total: number }) => {
  const top = rows.slice(0, TOP)
  const others = total - top.reduce((sum, row) => sum + row.clicks, 0)
  const visible = others > 0 ? [...top, { label: "Others", clicks: others }] : top

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">{title}</h3>

      <ul className="flex flex-col gap-3">
        {visible.map((row) => {
          const pct = total > 0 ? (row.clicks / total) * 100 : 0

          return (
            <li key={row.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{row.label}</span>
                <span className="shrink-0 text-muted-foreground">
                  {row.clicks} · {Math.round(pct)}%
                </span>
              </div>

              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const Page = () => {
  const { id } = useParams<{ id: string }>()

  const [link, setLink] = useState<LinkResponse | null>(null)
  const [stats, setStats] = useState<LinkStatsResponse | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [qrFailed, setQrFailed] = useState(false)

  const src = `/api/links/${id}/qr`

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    async function loadLink() {
      try {
        setLink(await api.get<LinkResponse>(`/api/links/${id}`, { signal }))
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (err instanceof ApiError && err.status === 404) setLinkError("Link not found")
        else setLinkError(err instanceof ApiError ? err.message : "Unexpected error")
      }
    }

    async function loadStats() {
      try {
        setStats(await api.get<LinkStatsResponse>(`/api/links/${id}/stats`, { signal }))
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (err instanceof ApiError && err.status === 429) setStatsError("Too many requests. Wait a moment and reload")
        else setStatsError(err instanceof ApiError ? err.message : "Unexpected error")
      }
    }

    loadLink()
    loadStats()
    return () => controller.abort()
  }, [id])

  const statsLoading = !stats && !statsError

  return (
    <div className="flex flex-col flex-1 items-center bg-background text-foreground gap-30">
        <header className="flex flex-row items-center justify-between w-full h-18 p-4 bg-[#171717]">
          <h1 className="text-4xl font-bold">Link Shortener</h1>

          <div className="flex flex-row gap-4">
            <Button  size="lg" variant="outline">
              <Link href="/links">My links</Link>
            </Button>

            <Button  size="lg" variant="outline">
              <Link href="/create">Create</Link>
            </Button>

            <Button  size="lg" variant="outline">
              <Link href="/acc">My account</Link>
            </Button>
          </div>
        </header>

        <main className="w-full max-w-6xl px-4 pb-12">
          <Card className="w-full">

            <CardHeader className="flex flex-col gap-2">
              <Button  variant="ghost" className="w-24">
                <Link href="/links">← My links</Link>
              </Button>

              {linkError && <p className="text-sm text-red-600">{linkError}</p>}

              {link && (
                <>
                  <CardTitle className="text-2xl font-bold break-all">{link.shortUrl}</CardTitle>
                  <p className="truncate text-sm text-muted-foreground" title={link.longUrl}>
                    → {link.longUrl}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {link.status === "active" ? "Active" : "Inactive"} · Created{" "}
                    {new Date(link.createdAt).toLocaleDateString()}
                  </p>
                </>
              )}
            </CardHeader>

            {/* Sem o link (404), não há o que mostrar: nem métricas, nem QR */}
            {!linkError && (
              <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <section className="flex min-w-0 flex-col gap-4 lg:col-span-2">
                  {statsLoading && <p>Loading...</p>}

                  {statsError && <p className="text-sm text-red-600">{statsError}</p>}

                  {stats && stats.totalClicks === 0 && (
                    <div className="flex flex-col gap-1 rounded-lg border border-border p-6 text-center">
                      <p className="font-semibold">No clicks yet</p>
                      <p className="text-sm text-muted-foreground">
                        Share your link and the data will show up here.
                      </p>
                    </div>
                  )}

                  {stats && stats.totalClicks > 0 && (
                    <>
                      <p className="text-3xl font-bold">
                        {stats.totalClicks} {stats.totalClicks === 1 ? "click" : "clicks"}
                      </p>

                      <RankingCard
                        title="Country"
                        total={stats.totalClicks}
                        rows={stats.byCountry.map((r) => ({ label: countryName(r.country), clicks: r.clicks }))}
                      />

                      <RankingCard
                        title="Device"
                        total={stats.totalClicks}
                        rows={stats.byDevice.map((r) => ({
                          label: DEVICE_LABELS[r.deviceType ?? "other"] ?? "Other",
                          clicks: r.clicks,
                        }))}
                      />

                      <RankingCard
                        title="Referrer"
                        total={stats.totalClicks}
                        rows={stats.byReferrer.map((r) => ({ label: r.referrer ?? "Direct", clicks: r.clicks }))}
                      />
                    </>
                  )}
                </section>

                <section className="flex flex-col items-center gap-2">
                  {qrFailed ? (
                    <p className="text-sm text-red-600">Could not load the QR code. Try again later.</p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt="QR code for this link"
                      width={256}
                      height={256}
                      className="rounded-md bg-white"
                      onError={() => setQrFailed(true)}
                    />
                  )}

                  <div className="flex flex-row gap-2 justify-center">
                    <Button  variant="outline" size="sm">
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
              </CardContent>
            )}

          </Card>
        </main>
    </div>
  )
}

export default Page