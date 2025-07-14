"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Calendar } from "lucide-react"

const FILE_TYPES = [
  { value: "pdf", label: "PDF Documents (.pdf)" },
  { value: "xlsx", label: "Excel Spreadsheets (.xlsx)" },
  { value: "docx", label: "Word Documents (.docx)" },
  { value: "pptx", label: "PowerPoint Presentations (.pptx)" },
  { value: "jpg", label: "JPEG Images (.jpg)" },
  { value: "png", label: "PNG Images (.png)" },
  { value: "zip", label: "ZIP Archives (.zip)" },
  { value: "csv", label: "CSV Files (.csv)" },
  { value: "all", label: "All File Types" },
]

export function FileTypeSelector() {
  const [selectedFileType, setSelectedFileType] = useState<string>("")
  const [fileNameFilter, setFileNameFilter] = useState<string>("")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true)
  const { toast } = useToast()

  // Set default date to 30 days ago
  useEffect(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    setDateFrom(thirtyDaysAgo.toISOString().split("T")[0])
  }, [])

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
          if (data?.file_name_filter) {
            setFileNameFilter(data.file_name_filter)
          }
          if (data?.date_from) {
            setDateFrom(data.date_from.split("T")[0])
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

    if (!dateFrom) {
      toast({
        title: "Error",
        description: "Please select a start date",
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
        body: JSON.stringify({
          fileType: selectedFileType,
          fileNameFilter: fileNameFilter.trim(),
          dateFrom: dateFrom,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Your download preferences have been saved.",
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
          <CardTitle>Download Preferences</CardTitle>
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
        <CardTitle>Download Preferences</CardTitle>
        <CardDescription>Configure what files to download from your Gmail</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="file-type">File Type</Label>
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

          <div className="space-y-2">
            <Label htmlFor="date-from">Download From Date</Label>
            <div className="relative">
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-name-filter">File Name Filter (Optional)</Label>
          <Input
            id="file-name-filter"
            type="text"
            placeholder="Enter keywords to filter file names (e.g., invoice, report, contract)"
            value={fileNameFilter}
            onChange={(e) => setFileNameFilter(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Only files containing these keywords in their name will be downloaded. Leave empty to download all files of
            the selected type.
          </p>
        </div>

        <Button onClick={handleSubmit} disabled={isLoading || !selectedFileType || !dateFrom} className="w-full">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>

        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <p className="font-medium mb-1">Current Settings:</p>
          <p>• File Type: {selectedFileType ? FILE_TYPES.find((t) => t.value === selectedFileType)?.label : "None"}</p>
          <p>• Date Range: {dateFrom ? `From ${new Date(dateFrom).toLocaleDateString()}` : "Not set"} to Today</p>
          <p>• Name Filter: {fileNameFilter || "None (all files)"}</p>
        </div>
      </CardContent>
    </Card>
  )
}
