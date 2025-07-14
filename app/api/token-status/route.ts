import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("access_token, refresh_token, token_expires_at")
      .eq("email", session.user.email)
      .single()

    if (error) {
      console.error("Token status fetch error:", error)
      return NextResponse.json({
        hasValidToken: false,
        expiresAt: null,
        isExpired: true,
      })
    }

    const hasAccessToken = !!data.access_token
    const hasRefreshToken = !!data.refresh_token
    const expiresAt = data.token_expires_at
    const isExpired = expiresAt ? new Date(expiresAt) <= new Date() : true

    console.log("Token status:", {
      email: session.user.email,
      hasAccessToken,
      hasRefreshToken,
      expiresAt,
      isExpired,
    })

    return NextResponse.json({
      hasValidToken: hasAccessToken && !isExpired,
      expiresAt,
      isExpired,
      hasRefreshToken,
    })
  } catch (error) {
    console.error("Token status error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
