import { useNavigate, useSearchParams } from "@solidjs/router"
import { createMemo, createSignal, Loading, Show, untrack } from "solid-js"

import { GitHubLogo, GoogleLogo } from "@/components/logos"
import { Button } from "@/components/ui/button"
import { getSession, signInWith } from "@/lib/auth"

// Only same-origin paths, so the login page can't bounce someone off-site.
// `//host` and `/\host` are protocol-relative to browsers.
function redirectPath(value: string | string[] | undefined): string {
  const single = Array.isArray(value) ? undefined : value
  return single !== undefined && /^\/(?![/\\])/.test(single) ? single : "/"
}

export default function LoginPage() {
  const [search] = useSearchParams()
  const session = createMemo(async () => await getSession())
  const redirect = () => redirectPath(search.redirect)
  const [failed, setFailed] = createSignal(false)

  async function signIn(provider: "google" | "github") {
    setFailed(false)
    try {
      await signInWith(provider, redirect())
    } catch {
      setFailed(true)
    }
  }

  return (
    <Loading>
      <Show fallback={<Redirect to={redirect()} />} when={!session()}>
        <main class="flex min-h-screen flex-col items-center justify-center gap-4">
          <h1 class="text-2xl font-semibold">Sydney Suburbs</h1>
          <p class="text-muted-foreground">
            Sign in to track the suburbs you&rsquo;ve visited.
          </p>
          <div class="flex flex-col gap-2">
            <Button
              onClick={async () => {
                await signIn("google")
              }}
              size="lg"
              variant="outline"
            >
              <GoogleLogo />
              Sign in with Google
            </Button>
            <Button
              onClick={async () => {
                await signIn("github")
              }}
              size="lg"
              variant="outline"
            >
              <GitHubLogo />
              Sign in with GitHub
            </Button>
          </div>
          <Show when={failed()}>
            <p class="text-sm text-destructive" role="alert">
              Couldn&rsquo;t start sign-in. Try again.
            </p>
          </Show>
        </main>
      </Show>
    </Loading>
  )
}

interface RedirectProps {
  to: string
}

// Already signed in, so there's nothing to do here.
function Redirect(props: RedirectProps) {
  const navigate = useNavigate()
  navigate(
    untrack(() => props.to),
    { replace: true },
  )
  return null
}
