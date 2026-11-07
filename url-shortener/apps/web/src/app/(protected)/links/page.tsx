"use client"
import { useState, useEffect } from "react"
import { api, ApiError } from "@/lib/api-client"
import { LinkResponse } from "@shortener/shared";

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const Page = () => {
  const [loading, setLoading] = useState<boolean>(false)
  const [links, setLinks] = useState<LinkResponse[]>()
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>()


  useEffect(() => {
    const controller = new AbortController();

    async function load() {
        try {
        const data = await api.get<LinkResponse[]>('/api/links', { signal: controller.signal });
        setLinks(data);
        } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof ApiError ? err.message : 'Unexpected error');
        } finally {
        setLoading(false);
        }
    }

    load();
    return () => controller.abort();
  }, []);

  const changeLinkStatus = async (link: LinkResponse) => {
    const next = link.status === 'active' ? 'inactive' : 'active';
    const updated = await api.patch<LinkResponse>(`/api/links/${link.id}`, { status: next })
    setLinks((prev) => prev?.map((l) => (l.id === updated.id ? updated : l)));
  }

  const removeLink = async (id: string) => {
    await api.delete(`api/links/${id}`)
    setLinks((prev) => prev?.filter((l) => l.id !== id))
  }

  const copyLink = async (link: LinkResponse) => {
    await navigator.clipboard.writeText(link.shortUrl)
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 1500);
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
            <Card className="w-full max-w-6xl">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold">Your links</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-border bg-muted/50 text-muted-foreground">
                            <tr>
                                <th scope="col" className="px-4 py-3 font-medium">Short link</th>
                                <th scope="col" className="px-4 py-3 font-medium">Destination</th>
                                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                                <th scope="col" className="px-4 py-3 font-medium">Created at</th>
                                <th scope="col" className="px-4 py-3 text-center font-medium">Actions</th>
                            </tr>
                            </thead>

                            <tbody>
                                {links?.map((link) => {
                                    return (
                                        <tr key={link.id}>
                                            <td className="px-4 py-3 font-mono">
                                                <a href={link.shortUrl} target="_blank" rel="noopener noreferrer" className="underline">
                                                    {link.shortUrl.replace(/^https?:\/\//, '')}
                                                </a>
                                            </td>

                                            <td className="max-w-xs truncate px-4 py-3" title={link.longUrl}>
                                                {link.longUrl}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span
                                                    className={
                                                    link.status === 'active'
                                                        ? 'rounded-full bg-green-500/15 px-2 py-0.5 text-green-600'
                                                        : 'rounded-full bg-zinc-500/15 px-2 py-0.5 text-zinc-500'
                                                    }
                                                >
                                                    {link.status === 'active' ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-3">
                                                {new Date(link.createdAt).toLocaleDateString('pt-BR')}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-3">
                                                <div className="flex flex-row gap-2">                                                    
                                                    <Button variant={"outline"}
                                                    onClick={() => copyLink(link)}>
                                                        {copiedId === link.id ? 'Copied' : 'Copy'}
                                                    </Button>
                                                    
                                                    <Button variant={"outline"}
                                                    onClick={() => changeLinkStatus(link)}>
                                                        {link.status === "active" ? "Deactivate" : "Activate"}
                                                    </Button>

                                                    <Button variant={"destructive"}
                                                    onClick={() => removeLink(link.id)}>
                                                        Delete
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {links?.length === 0 && <p className="text-center pt-4">You haven&#39;t created any link. <Link href="/create" className="underline">Create the first</Link></p>}

                    {loading && <p className="text-center pt-4">Loading</p>}

                    {error && <p className="text-red-500 text-center pt-4">{error}</p>}
                </CardContent>
            </Card>
        </main>
    </div>
  )
}

export default Page