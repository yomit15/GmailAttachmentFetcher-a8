import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Manual token refresh requested for:", session.user.email)

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("refresh_token")
      .eq("email", session.user.email)
      .single()

    if (error || !data.refresh_token) {
      console.error("No refresh token found:", error)
      return NextResponse.json(
        {
          error: "No refresh token found. Please sign out and sign in again.",
        },
        { status: 400 },
      )
    }

    // Refresh the token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: data.refresh_token,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error("Manual token refresh failed:", refreshedTokens)
      return NextResponse.json(
        {
          error: "Failed to refresh token. Please sign out and sign in again.",
        },
        { status: 400 },
      )
    }

    const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000)

    // Update tokens in Supabase
    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        access_token: refreshedTokens.access_token,
        refresh_token: refreshedTokens.refresh_token || data.refresh_token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", session.user.email)

    if (updateError) {
      console.error("Error updating refreshed tokens:", updateError)
      return NextResponse.json({ error: "Failed to update tokens" }, { status: 500 })
    }

    console.log("Manual token refresh successful")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Refresh token error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
