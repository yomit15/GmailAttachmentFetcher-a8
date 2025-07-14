import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fileType, fileNameFilter, dateFrom } = await request.json()

    if (!fileType) {
      return NextResponse.json({ error: "File type is required" }, { status: 400 })
    }

    if (!dateFrom) {
      return NextResponse.json({ error: "Start date is required" }, { status: 400 })
    }

    // Update user preferences (preserve existing tokens)
    const { data, error } = await supabaseAdmin.from("users").upsert(
      {
        email: session.user.email,
        file_type: fileType,
        file_name_filter: fileNameFilter || null,
        date_from: dateFrom,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "email",
        ignoreDuplicates: false,
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

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("file_type, file_name_filter, date_from, created_at, updated_at")
      .eq("email", session.user.email)
      .single()

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
