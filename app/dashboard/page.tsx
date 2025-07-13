import { getServerSession } from "next-auth/next"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { FileTypeSelector } from "@/components/file-type-selector"
import { UserCard } from "@/components/user-card"
import { Separator } from "@/components/ui/separator"
import { DownloadButton } from "@/components/download-button"

export default async function DashboardPage() {
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
          <h1 className="text-lg font-semibold">Dashboard</h1>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <FileTypeSelector />
              <DownloadButton />
            </div>
            <div>
              <UserCard user={session.user} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </>
  )
}
