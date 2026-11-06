"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, ApiError, fieldErrors } from "@/lib/api-client"
import { createLinkSchema } from '@shortener/shared';

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Page = () => {
  return (
    <div className="flex flex-col flex-1 items-center bg-background text-foreground pt-12">
        <header>
            
        </header>
        <main>

        </main>
    </div>
  )
}

export default Page