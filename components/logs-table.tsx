"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Log {
  id: string
  user_email: string
  file_name: string
  file_type: string
  status: string
  created_at: string
}

interface LogsTableProps {
  userEmail: string
}

export function LogsTable({ userEmail }: LogsTableProps) {
  const [logs, setLogs] = useState<Log[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshLogs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/logs")
      if (response.ok) {
        const { data } = await response.json()
        setLogs(data || [])
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch("/api/logs")
        if (response.ok) {
          const { data } = await response.json()
          setLogs(data || [])
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLogs()
  }, [userEmail])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Download Logs</CardTitle>
          <CardDescription>Loading your download history...</CardDescription>
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
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Download Logs</CardTitle>
          <CardDescription>View your recent Gmail attachment downloads</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={refreshLogs} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No download logs found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Downloads will appear here once the automation starts running
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.file_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.file_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={log.status === "success" ? "default" : "destructive"}>{log.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
