import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { google } from "googleapis"
import { Readable } from "stream";

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Fetching user data for:", session.user.email)

    // Get user's data including tokens from Supabase
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("file_type, file_name_filter, date_from, gmail_folder, access_token, refresh_token, token_expires_at")
      .eq("email", session.user.email)
      .single()

    if (userError) {
      console.error("User fetch error:", userError)
      return NextResponse.json({ error: "User not found. Please sign in again." }, { status: 400 })
    }

    if (!userData) {
      return NextResponse.json({ error: "User data not found. Please sign in again." }, { status: 400 })
    }

    console.log("User data:", {
      email: session.user.email,
      hasFileType: !!userData.file_type,
      hasAccessToken: !!userData.access_token,
      hasRefreshToken: !!userData.refresh_token,
      fileNameFilter: userData.file_name_filter,
      dateFrom: userData.date_from,
      gmailFolder: userData.gmail_folder,
      tokenExpiresAt: userData.token_expires_at,
    })

    if (!userData.file_type) {
      return NextResponse.json({ error: "Please set your file type preference first" }, { status: 400 })
    }

    if (!userData.date_from) {
      return NextResponse.json({ error: "Please set your date preference first" }, { status: 400 })
    }

    if (!userData.gmail_folder) {
      return NextResponse.json({ error: "Please select a Gmail folder first" }, { status: 400 })
    }

    if (!userData.access_token) {
      return NextResponse.json(
        {
          error: "No access token found. Please sign out and sign in again to reconnect your Gmail account.",
        },
        { status: 401 },
      )
    }

    // Check if token is expired
    let currentAccessToken = userData.access_token
    if (userData.token_expires_at) {
      const tokenExpiresAt = new Date(userData.token_expires_at)
      const now = new Date()

      if (tokenExpiresAt <= now && userData.refresh_token) {
        console.log("Token expired, refreshing...")
        const refreshResult = await refreshUserToken(session.user.email, userData.refresh_token)
        if (!refreshResult.success) {
          return NextResponse.json(
            {
              error: "Token expired and refresh failed. Please sign out and sign in again.",
            },
            { status: 401 },
          )
        }
        currentAccessToken = refreshResult.accessToken
      }
    }

    // Initialize Google APIs with fresh token
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: currentAccessToken })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })
    const drive = google.drive({ version: "v3", auth: oauth2Client })

    // Test Gmail API access
    try {
      await gmail.users.getProfile({ userId: "me" })
      console.log("Gmail API access confirmed")
    } catch (gmailError) {
      console.error("Gmail API access failed:", gmailError)
      return NextResponse.json(
        {
          error: "Gmail API access failed. Please sign out and sign in again.",
        },
        { status: 401 },
      )
    }

    // Get folder name for display
    let folderName = "Unknown Folder"
    try {
      const labelResponse = await gmail.users.labels.get({
        userId: "me",
        id: userData.gmail_folder,
      })
      folderName = labelResponse.data.name || userData.gmail_folder
    } catch (error) {
      console.error("Failed to get folder name:", error)
      folderName = userData.gmail_folder
    }

    // Build search query based on user preferences
    const fromDate = new Date(userData.date_from)
    const dateQuery = `after:${fromDate.getFullYear()}/${(fromDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${fromDate.getDate().toString().padStart(2, "0")}`

    // Search for emails with attachments in the specified folder
    let searchQuery = `has:attachment ${dateQuery} label:${userData.gmail_folder}`

    // Add filename filter if provided
    if (userData.file_name_filter) {
      const keywords = userData.file_name_filter.split(/\s+/).filter(Boolean)
      if (keywords.length > 0) {
        // Add filename search terms
        const filenameQuery = keywords.map((keyword: string) => `filename:${keyword}`).join(" OR ")
        searchQuery += ` (${filenameQuery})`
      }
    }

    console.log("Gmail search query:", searchQuery)

    const messagesResponse = await gmail.users.messages.list({
      userId: "me",
      q: searchQuery,
      maxResults: 100,
    })

    const messages = messagesResponse.data.messages || []
    let attachmentCount = 0
    const downloadResults = []

    console.log(`Found ${messages.length} emails with attachments in folder: ${folderName}`)

    // Create a folder in Google Drive for attachments
    const driveFolderName = `Gmail Attachments - ${folderName} - ${new Date().toISOString().split("T")[0]} - ${
      userData.file_type
    }${userData.file_name_filter ? ` (${userData.file_name_filter})` : ""}`
    const folderMetadata = {
      name: driveFolderName,
      mimeType: "application/vnd.google-apps.folder",
    }

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id",
    })

    const folderId = folder.data.id

    // Add this before the upload loop
    const matchingAttachments = [];

    // Process each message
    for (const message of messages.slice(0, 50)) {
      // Limit to 50 for performance
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
            const matchesFileType = userData.file_type === "all" || fileExtension === userData.file_type

            // Check if filename matches the filter (if provided)
            let matchesNameFilter = true
            if (userData.file_name_filter) {
              const keywords = userData.file_name_filter.toLowerCase().split(/\s+/).filter(Boolean)
              const filename = part.filename.toLowerCase()
              matchesNameFilter = keywords.some((keyword: string) => filename.includes(keyword))
            }

            if (matchesFileType && matchesNameFilter) {
              matchingAttachments.push({
                filename: part.filename,
                size: part.body.size,
                messageId: message.id,
                fileType: fileExtension,
                gmailFolder: userData.gmail_folder,
                searchQuery,
              });
              attachmentCount++

              try {
                // Get attachment data
                const attachment = await gmail.users.messages.attachments.get({
                  userId: "me",
                  messageId: message.id!,
                  id: part.body.attachmentId,
                })

                // Decode base64 data
                const data = attachment.data.data; // base64 string
                if (!data) {
                  console.error("No attachment data for:", part.filename);
                  throw new Error("No attachment data received");
                }

                const buffer = Buffer.from(data, "base64");
                console.log(`Attachment ${part.filename}: ${buffer.length} bytes`);

                if (buffer.length === 0) {
                  console.error("Empty buffer for:", part.filename);
                  throw new Error("Empty attachment data");
                }

                // Upload to Google Drive
                console.log(`Uploading ${part.filename} (${buffer.length} bytes) to Drive folder ${folderId}`);

                const fileMetadata = {
                  name: part.filename,
                  parents: [folderId!],
                }

                const stream = Readable.from(buffer);

                const media = {
                  mimeType: getMimeType(fileExtension),
                  body: stream,
                }

                const driveFile = await drive.files.create({
                  requestBody: fileMetadata,
                  media: media,
                  fields: "id,name,webViewLink",
                })

                console.log("Drive upload response:", JSON.stringify(driveFile.data, null, 2));
                if (!driveFile.data.id) {
                  throw new Error("Drive upload failed for " + part.filename);
                }

                // Log the successful upload
                await supabaseAdmin.from("logs").insert({
                  user_email: session.user.email,
                  file_name: part.filename,
                  file_type: fileExtension,
                  status: "success",
                  drive_file_id: driveFile.data.id,
                  drive_link: driveFile.data.webViewLink,
                  search_query: searchQuery,
                  gmail_folder: userData.gmail_folder,
                  gmail_folder_name: folderName,
                })

                downloadResults.push({
                  filename: part.filename,
                  size: part.body.size,
                  status: "success",
                  driveLink: driveFile.data.webViewLink,
                })
              } catch (attachmentError) {
                console.error("Error downloading/uploading attachment:", attachmentError)

                // Log the failed download
                await supabaseAdmin.from("logs").insert({
                  user_email: session.user.email,
                  file_name: part.filename,
                  file_type: fileExtension,
                  status: "failed",
                  search_query: searchQuery,
                  gmail_folder: userData.gmail_folder,
                  gmail_folder_name: folderName,
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

    // Log to console for debugging
    console.log("Matching attachments before upload:", matchingAttachments);

    // Log to Supabase logs table (optional, for traceability)
    if (matchingAttachments.length > 0) {
      await supabaseAdmin.from("logs").insert(
        matchingAttachments.map(att => ({
          user_email: session.user.email,
          file_name: att.filename,
          file_type: att.fileType,
          status: "matched", // Use a new status to indicate pre-upload match
          search_query: att.searchQuery,
          gmail_folder: att.gmailFolder,
          message_id: att.messageId,
          size: att.size,
          note: "Matched by filters, before upload"
        }))
      );
    }

    return NextResponse.json({
      success: true,
      emailCount: messages.length,
      attachmentCount,
      downloads: downloadResults,
      folderName: driveFolderName,
      gmailFolder: folderName,
      searchQuery,
      dateRange: `From ${fromDate.toLocaleDateString()} to ${new Date().toLocaleDateString()}`,
      nameFilter: userData.file_name_filter || "None",
      message: `Processed ${messages.length} emails from "${folderName}" and uploaded ${attachmentCount} matching attachments to Google Drive`,
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json({ error: "Failed to download attachments. Please try again." }, { status: 500 })
  }
}

// Helper function to refresh user token
async function refreshUserToken(email: string, refreshToken: string) {
  try {
    console.log("Refreshing token for user:", email)

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error("Token refresh failed:", refreshedTokens)
      return { success: false }
    }

    const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000)

    // Update tokens in Supabase
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        access_token: refreshedTokens.access_token,
        refresh_token: refreshedTokens.refresh_token || refreshToken,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", email)

    if (error) {
      console.error("Error updating refreshed tokens:", error)
      return { success: false }
    }

    console.log("Successfully refreshed and updated tokens")
    return { success: true, accessToken: refreshedTokens.access_token }
  } catch (error) {
    console.error("Error refreshing token:", error)
    return { success: false }
  }
}

// Helper function to get MIME type
function getMimeType(extension: string): string {
  const mimeTypes: { [key: string]: string } = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    zip: "application/zip",
    csv: "text/csv",
  }
  return mimeTypes[extension] || "application/octet-stream"
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
