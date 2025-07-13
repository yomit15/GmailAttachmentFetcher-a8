"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

const FILE_TYPES = [
  { value: "pdf", label: "PDF Documents (.pdf)" },
  { value: "xlsx", label: "Excel Spreadsheets (.xlsx)" },
  { value: "docx", label: "Word Documents (.docx)" },
  { value: "pptx", label: "PowerPoint Presentations (.pptx)" },
  { value: "jpg", label: "JPEG Images (.jpg)" },
  { value: "png", label: "PNG Images (.png)" },
  { value: "zip", label: "ZIP Archives (.zip)" },
  { value: "csv", label: "CSV Files (.csv)" },
]

export function FileTypeSelector() {
  const [selectedFileType, setSelectedFileType] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // Load existing preferences
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/preferences")
        if (response.ok) {
          const { data } = await response.json()
          if (data?.file_type) {
            setSelectedFileType(data.file_type)
          }
        }
      } catch (error) {
        console.error("Failed to load preferences:", error)
      } finally {
        setIsLoadingPrefs(false)
      }
    }

    loadPreferences()
  }, [])

  const handleSubmit = async () => {
    if (!selectedFileType) {
      toast({
        title: "Error",
        description: "Please select a file type",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileType: selectedFileType }),
      })

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Your file type preference has been saved.",
        })
      } else {
        throw new Error("Failed to save preferences")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingPrefs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>File Type Preferences</CardTitle>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>File Type Preferences</CardTitle>
        <CardDescription>Select the type of files you want to automatically download from Gmail</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="file-type" className="text-sm font-medium">
            File Type
          </label>
          <Select value={selectedFileType} onValueChange={setSelectedFileType}>
            <SelectTrigger>
              <SelectValue placeholder="Select a file type" />
            </SelectTrigger>
            <SelectContent>
              {FILE_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSubmit} disabled={isLoading || !selectedFileType} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  )
}
