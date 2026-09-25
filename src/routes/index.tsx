import { createFileRoute, Link } from "@tanstack/react-router"

import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/")({
  component: MapPage,
})

function MapPage() {
  return (
    <main className="relative min-h-screen">
      <header className="absolute top-4 right-4">
        <Account />
      </header>
      <h1 className="p-4 text-xl font-semibold">Sydney Suburbs</h1>
    </main>
  )
}

function Account() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return null
  }

  if (!session) {
    return (
      <Link className={buttonVariants()} to="/login">
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{session.user.email}</span>
      <Button
        onClick={async () => {
          await authClient.signOut()
        }}
        variant="outline"
      >
        Sign out
      </Button>
    </div>
  )
}
