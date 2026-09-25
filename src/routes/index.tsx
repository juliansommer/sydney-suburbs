import { createFileRoute } from "@tanstack/react-router"

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
        <button
          className="rounded-md bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
          onClick={async () => {
            await authClient.signIn.social({ provider: "google" })
          }}
          type="button"
        >
          Sign in with Google
        </button>
      </main>
    )
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold">Sydney Suburbs</h1>
      <p className="text-slate-600">Signed in as {session.user.email}</p>
      <button
        className="mt-2 text-sm text-slate-500 underline"
        onClick={async () => {
          await authClient.signOut()
        }}
        type="button"
      >
        Sign out
      </button>
    </main>
  )
}
