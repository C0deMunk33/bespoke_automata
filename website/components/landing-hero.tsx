"use client"

import TypewriterComponent from "typewriter-effect"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export const LandingHero = () => {

    return (
        <div className="text-white font-bold pt-24 sm:pt-36 text-center space-y-5">
            <div className="text-transparent bg-clip-text bg-gradient-to-r
                from-zinc-200 to-[#10344c] pb-3 text-4xl sm:text-5xl md:text-6xl lg:text-7xl
                space-y-5 font-extrabold">
                <TypewriterComponent 
                    options={{
                        strings: [
                            "Bespoke Intelligence",
                            "Bespoke Automation",
                            "Bespoke Cognitive Structures",
                        ],
                        autoStart: true,
                        loop: true,
                    }}
                />
            </div>
            <div className="flex flex-col sm:flex-row justify-center pt-10">
                <div className="flex-1 mx-10 aspect-video">
                    <iframe
                        className="w-full h-full"
                        src="https://www.youtube.com/embed/Z1GVMgZtT2c"
                        frameBorder="0"
                        title="YouTube video player"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>
                <div className="mt-10">
                    <div className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl
                    space-y-5 font-extrabold">
                        <h1>
                            Build AI Agents
                        </h1>
                    </div>
                    <div className="text-sm md:text-xl front-light text-white pt-10">
                        Leverage Intelligence for 100X Productivity.
                    </div>
                    <div className="flex items-center justify-center space-x-4 pt-10">
                        <div className="text-zinc-400 text-xs md:text-sm font-normal">
                            Wield the Power of Computation.
                        </div>
                        <div>
                            <Link href="https://github.com/C0deMunk33/bespoke_automata">
                                    <Button className="text-black" variant="outline">
                                        GitHub
                                    </Button>
                            </Link>
                        </div>
                    </div>
                </div> 
            </div>
        </div>
    )
}