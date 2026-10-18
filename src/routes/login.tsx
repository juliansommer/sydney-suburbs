import { useQuery } from "@tanstack/solid-query"
import { createFileRoute, Navigate } from "@tanstack/solid-router"
import { Match, Switch } from "solid-js"
import { z } from "zod/mini"

import { GitHubLogo, GoogleLogo } from "@/components/logos"
import { Button } from "@/components/ui/button"
import { sessionQuery, signInWith } from "@/lib/auth"

// Only same-origin paths, so the login page can't bounce someone off-site.
// `//host` and `/\host` are protocol-relative to browsers.
const redirectPath = z
  .string()
  .check(z.refine((path) => /^\/(?![/\\])/.test(path)))

interface LoginSearch {
  redirect?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: (search): LoginSearch => ({
    redirect: redirectPath.safeParse(search.redirect).data,
  }),
  component: LoginPage,
})

function LoginPage() {
  const session = useQuery(() => sessionQuery)
  const redirect = Route.useSearch({ select: (s) => s.redirect ?? "/" })

  return (
    <Switch>
      <Match when={session.isSuccess && session.data}>
        {/* `href` wins over `to`, which is only there because the types need it. */}
        <Navigate href={redirect()} replace to="/" />
      </Match>
      <Match when={!session.isPending}>
        <main class="flex min-h-screen flex-col items-center justify-center gap-4">
          <h1 class="text-2xl font-semibold">Sydney Suburbs</h1>
          <p class="text-muted-foreground">
            Sign in to track the suburbs you&rsquo;ve visited.
          </p>
          <div class="flex flex-col gap-2">
            <Button
              onClick={async () => {
                await signInWith("google", redirect())
              }}
              size="lg"
              variant="outline"
            >
              <GoogleLogo />
              Sign in with Google
            </Button>
            <Button
              onClick={async () => {
                await signInWith("github", redirect())
              }}
              size="lg"
              variant="outline"
            >
              <GitHubLogo />
              Sign in with GitHub
            </Button>
          </div>
        </main>
      </Match>
    </Switch>
  )
}
