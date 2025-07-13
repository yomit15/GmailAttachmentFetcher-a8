import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { LogsTable } from "@/components/logs-table"
import { Separator } from "@/components/ui/separator"

export default async function LogsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/")
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">Download Logs</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <LogsTable userEmail={session.user?.email || ""} />
        </div>
      </SidebarInset>
    </>
  )
}
