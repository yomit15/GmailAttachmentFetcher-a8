import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { google } from "googleapis"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's file type preference
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("file_type")
      .eq("email", session.user.email)
      .single()

    if (userError || !userData?.file_type) {
      return NextResponse.json({ error: "Please set your file type preference first" }, { status: 400 })
    }

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: session.accessToken })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const dateQuery = `after:${thirtyDaysAgo.getFullYear()}/${(thirtyDaysAgo.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${thirtyDaysAgo.getDate().toString().padStart(2, "0")}`

    // Search for emails with attachments
    const searchQuery = `has:attachment ${dateQuery}`

    const messagesResponse = await gmail.users.messages.list({
      userId: "me",
      q: searchQuery,
      maxResults: 100,
    })

    const messages = messagesResponse.data.messages || []
    let attachmentCount = 0
    const downloadResults = []

    // Process each message
    for (const message of messages) {
      try {
        const messageDetail = await gmail.users.messages.get({
          userId: "me",
          id: message.id!,
        })

        const parts = getAllParts(messageDetail.data.payload)

        for (const part of parts) {
          if (part.filename && part.body?.attachmentId) {
            const fileExtension = getFileExtension(part.filename)

            // Check if this attachment matches user's preferred file type
            if (fileExtension === userData.file_type) {
              attachmentCount++

              try {
                // Get attachment data
                const attachment = await gmail.users.messages.attachments.get({
                  userId: "me",
                  messageId: message.id!,
                  id: part.body.attachmentId,
                })

                // In a real implementation, you would save the file to cloud storage
                // For now, we'll just log the successful "download"
                const logResult = await supabase.from("logs").insert({
                  user_email: session.user.email,
                  file_name: part.filename,
                  file_type: fileExtension,
                  status: "success",
                })

                downloadResults.push({
                  filename: part.filename,
                  size: part.body.size,
                  status: "success",
                })
              } catch (attachmentError) {
                console.error("Error downloading attachment:", attachmentError)

                // Log the failed download
                await supabase.from("logs").insert({
                  user_email: session.user.email,
                  file_name: part.filename,
                  file_type: fileExtension,
                  status: "failed",
                })

                downloadResults.push({
                  filename: part.filename,
                  status: "failed",
                })
              }
            }
          }
        }
      } catch (messageError) {
        console.error("Error processing message:", messageError)
      }
    }

    return NextResponse.json({
      success: true,
      emailCount: messages.length,
      attachmentCount,
      downloads: downloadResults,
      message: `Processed ${messages.length} emails and found ${attachmentCount} matching attachments`,
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json({ error: "Failed to download attachments. Please try again." }, { status: 500 })
  }
}

// Helper function to recursively get all parts from email payload
function getAllParts(payload: any): any[] {
  const parts = []

  if (payload.parts) {
    for (const part of payload.parts) {
      parts.push(...getAllParts(part))
    }
  } else {
    parts.push(payload)
  }

  return parts
}

// Helper function to extract file extension
function getFileExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase()
  return extension || ""
}
