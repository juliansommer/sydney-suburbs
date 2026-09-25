import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/")({
  component: MapPage,
})

function MapPage() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return null
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">Sydney Suburbs</h1>
        <Button
          onClick={async () => {
            await authClient.signIn.social({ provider: "google" })
          }}
        >
          Sign in with Google
        </Button>
      </main>
    )
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold">Sydney Suburbs</h1>
      <p className="text-muted-foreground">Signed in as {session.user.email}</p>
      <Button
        className="mt-2"
        onClick={async () => {
          await authClient.signOut()
        }}
        variant="link"
      >
        Sign out
      </Button>
    </main>
  )
}
