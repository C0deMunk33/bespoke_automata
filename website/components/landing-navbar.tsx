"use client"
import { useEffect, useState } from "react";

import { Poiret_One } from "next/font/google"
import Image from "next/image" 
import Link from "next/link"

import { Button } from "@/components/ui/button"

const font = Poiret_One({ 
    weight: "400", 
    subsets: ["latin"]
});

export const LandingNavbar = () => {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
        setIsMounted(true)
    }, [])

    if (!isMounted) {
        return null
    }

    return (
        <nav className="p-4 bg-transparent flex items-center justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-center w-full">
                <Link 
                    href="/"
                    className="flex items-center"
                    >
                        <div className="relative h-24 w-96 mr-4">
                            <Link href="/">
                            <a className="block h-full w-full">
                            <img
                                src="/banner_no_bg.png"
                                alt="Logo"
                                className="rounded-md object-contain w-full h-full"
                                style={{ objectFit: 'contain' }}
                            />
                            </a>
                            </Link>
                        </div>
                        {/* <h1 className={cn("text-2xl font-bold text-white", font.className)}>Vaut</h1> */}
                </Link>
                <div className="flex gap-x-2 gap-2 pt-10 sm:pt-0">
                    <Link href="https://github.com/C0deMunk33/bespoke_automata">
                        <Button variant="outline" className="rounded-full">
                            GitHub
                        </Button>
                    </Link>
                    <Link href="https://discord.gg/NHFMcsh8pJ">
                        <Button variant="outline" className="rounded-full">
                            Discord
                        </Button>
                    </Link>
                    <Link href="https://twitter.com/icodeagents">
                        <Button variant="outline" className="rounded-full">
                            Contact
                        </Button>
                    </Link>
                </div>
            </div>
        </nav>
    )
}