"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Download, Loader2 } from "lucide-react"

export function DownloadButton() {
  const [isDownloading, setIsDownloading] = useState(false)
  const { toast } = useToast()

  const handleDownload = async () => {
    setIsDownloading(true)

    try {
      const response = await fetch("/api/download-attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const result = await response.json()

      if (response.ok) {
        toast({
          title: "Download Started!",
          description: `Found ${result.emailCount} emails. Processing ${result.attachmentCount} attachments.`,
        })
      } else {
        throw new Error(result.error || "Failed to start download")
      }
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download Attachments</CardTitle>
        <CardDescription>Download attachments from emails received in the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleDownload} disabled={isDownloading} className="w-full" size="lg">
          {isDownloading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing Emails...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Attachments
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          This will scan your Gmail for attachments matching your selected file type
        </p>
      </CardContent>
    </Card>
  )
}
