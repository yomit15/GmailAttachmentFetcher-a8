import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fileType } = await request.json()

    if (!fileType) {
      return NextResponse.json({ error: "File type is required" }, { status: 400 })
    }

    // Upsert user preferences
    const { data, error } = await supabase.from("users").upsert(
      {
        email: session.user.email,
        file_type: fileType,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "email",
      },
    )

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase.from("users").select("*").eq("email", session.user.email).single()

    if (error && error.code !== "PGRST116") {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
