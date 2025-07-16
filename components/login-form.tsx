"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Loader2 } from "lucide-react"

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      await signIn("google", {
        callbackUrl: "/dashboard",
        redirect: true,
      })
    } catch (error) {
      console.error("Sign in error:", error)
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle>Welcome</CardTitle>
        <CardDescription>Sign in with your Google account to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleGoogleSignIn} disabled={isLoading} className="w-full" size="lg">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Sign in with Google
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
