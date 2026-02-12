"use client"

import { SignupForm } from "@/components/signup-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { LayoutBottomIcon } from "@hugeicons/core-free-icons"
import Image from "next/image";

export default function SignupPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <HugeiconsIcon icon={LayoutBottomIcon} strokeWidth={2} className="size-4" />
            </div>
            Cold Network Plane - Sign up
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <Image
            src="/radial_line.svg"
            alt="Image"
            className="absolute inset-0
                      m-auto
                      w-[100%] h-[100%]
                      object-contain
                      dark:brightness-[0.2]
                      dark:grayscale"
            fill
        />
      </div>
    </div>
  )
}
