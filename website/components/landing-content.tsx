"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const testimonials = [
    {
        benefit: "Cost Reduction",
        description: "Process Automation reduces costs for entry-level tasks upwards of 90%",
    },
    {
        benefit: "Speed",
        description: "Automate repetitive tasks and increase speed of execution",
    },
    {
        benefit: "Accuracy",
        description: "Reduce human error and increase accuracy",
    },
]

export const LandingContent = () => {   
    return (
        <div className="px-10 pb-20">
            <h2 className="text-center text-white font-extrabold mb-10 text-4xl">
                Use Automata For
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-3
                    lg:grid-cols-3 gap-4">
                  {testimonials.map((testimonial) => (
                    <Card key={testimonial.description} className="bg-[#192339] border-none text-white">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-x-2">
                                <div>
                                    <p className="text-lg">
                                      {testimonial.benefit}  
                                    </p>
                                </div>
                            </CardTitle>
                            <CardContent className="pt-4 px-0">
                                {testimonial.description}
                            </CardContent>                        
                        </CardHeader>
                    </Card>
                  ))
                }  
            </div>
            <div className="flex items-center justify-center gap-x-2 pt-20">
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
                        X
                    </Button>
                </Link>
            </div>
        </div>
    )
}
