"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { signOut } from "next-auth/react"
import type { User } from "next-auth"

interface UserCardProps {
  user: User | undefined
}

interface TokenStatus {
  hasValidToken: boolean
  expiresAt: string | null
  isExpired: boolean
  hasRefreshToken: boolean
}

export function UserCard({ user }: UserCardProps) {
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (user?.email) {
      checkTokenStatus()
    }
  }, [user?.email])

  const checkTokenStatus = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/token-status")
      if (response.ok) {
        const data = await response.json()
        setTokenStatus(data)
      } else {
        console.error("Failed to fetch token status")
      }
    } catch (error) {
      console.error("Failed to check token status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshToken = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch("/api/refresh-token", { method: "POST" })
      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Token refreshed successfully",
        })
        await checkTokenStatus()
      } else {
        toast({
          title: "Refresh Failed",
          description: result.error || "Failed to refresh token",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh token",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleReconnect = () => {
    signOut({ callbackUrl: "/" })
  }

  if (!user) return null

  const initials =
    user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  const isConnected = tokenStatus?.hasValidToken && !tokenStatus?.isExpired

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Account</CardTitle>
        <CardDescription>Your account information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src={user.image || ""} alt={user.name || ""} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant={isConnected ? "default" : "destructive"}>
              {isLoading ? "Checking..." : isConnected ? "Connected" : "Disconnected"}
            </Badge>
            <Button variant="outline" size="sm" onClick={refreshToken} disabled={isRefreshing || isLoading}>
              {isRefreshing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>

          {tokenStatus?.expiresAt && (
            <p className="text-xs text-muted-foreground">
              Token expires: {new Date(tokenStatus.expiresAt).toLocaleDateString()}
            </p>
          )}

          {!isConnected && !isLoading && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs">Gmail access needs reconnection</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleReconnect} className="w-full bg-transparent">
                Reconnect Gmail
              </Button>
            </div>
          )}

          <span className="text-xs text-muted-foreground">Gmail integration enabled</span>
        </div>
      </CardContent>
    </Card>
  )
}
