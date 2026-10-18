import { Drawer, type DrawerRoot } from "base-ui-solid/drawer"
import { createMemo, createSignal, Show } from "solid-js"

import {
  FactsRow,
  MoreDetails,
  SuburbMedia,
  Summary,
  useSuburbFacts,
} from "@/components/suburb-facts"
import {
  CloseButton,
  CouncilButton,
  PanelBody,
  type SuburbPanelProps,
} from "@/components/suburb-panel-body"
import type { Suburb } from "@/types/suburb"

// Tall enough for the name, the council and the visited button.
const PEEK = "9.5rem"
const SNAP_POINTS = [PEEK, 1]

// Non-modal, so the map stays usable above it and tapping another suburb
// swaps the content in place. Swiping down from the peek closes it. Stays
// mounted so it can slide in and out, keeping the last suburb while it leaves.
export function SuburbSheet(props: SuburbPanelProps) {
  const [snapPoint, setSnapPoint] = createSignal<DrawerRoot.SnapPoint | null>(
    PEEK,
  )
  const shown = createMemo<Suburb | undefined>((prev) => props.suburb ?? prev)
  return (
    <Drawer.Root
      disablePointerDismissal
      modal={false}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose()
        }
      }}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setSnapPoint(PEEK)
        }
      }}
      onSnapPointChange={setSnapPoint}
      open={!!props.suburb}
      snapPoint={snapPoint()}
      snapPoints={SNAP_POINTS}
    >
      <Drawer.VirtualKeyboardProvider>
        <Show when={shown()}>
          {(suburb) => (
            <SheetPopup
              onClose={props.onClose}
              onToggleOverlay={props.onToggleOverlay}
              // Drops to the peek so the outlined council is in view.
              onZoomToCouncil={(lga) => {
                setSnapPoint(PEEK)
                props.onZoomToCouncil(lga)
              }}
              overlay={props.overlay}
              signedIn={props.signedIn}
              suburb={suburb()}
            />
          )}
        </Show>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  )
}

interface SheetPopupProps extends SuburbPanelProps {
  suburb: Suburb
}

// The peek shows the name and visit controls; the photo, facts and summary
// sit below and come into view as the sheet expands.
function SheetPopup(props: SheetPopupProps) {
  const facts = useSuburbFacts(() => props.suburb.id)
  return (
    <Drawer.Portal>
      <Drawer.Viewport class="pointer-events-none fixed inset-0 flex items-end">
        <Drawer.Popup
          aria-label={props.suburb.name}
          class="pointer-events-auto flex max-h-[calc(100dvh-4rem)] w-full [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] touch-none flex-col rounded-t-xl border-t bg-card text-card-foreground shadow-lg transition-transform duration-450 ease-sheet outline-none data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none motion-reduce:transition-none"
          initialFocus={false}
        >
          <div class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <header class="flex shrink-0 items-start justify-between gap-2 px-4 pt-2 pb-4">
            <div>
              <Drawer.Title class="text-lg font-semibold">
                {props.suburb.name}
              </Drawer.Title>
              <Drawer.Description class="text-sm text-muted-foreground">
                <CouncilButton
                  lga={props.suburb.lga}
                  onZoom={props.onZoomToCouncil}
                />
              </Drawer.Description>
            </div>
            <CloseButton onClose={props.onClose} />
          </header>
          <Drawer.Content class="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 pb-safe-bottom">
            <div class="flex flex-col gap-4 pb-4">
              <PanelBody signedIn={props.signedIn} suburbId={props.suburb.id} />
              <SuburbMedia
                class="mx-auto w-full overflow-hidden rounded-lg border"
                name={props.suburb.name}
                facts={facts()}
              />
              <div class="flex flex-col gap-2">
                <FactsRow facts={facts()} />
                <Summary facts={facts()} />
                <MoreDetails
                  onToggleOverlay={props.onToggleOverlay}
                  overlay={props.overlay}
                  facts={facts()}
                />
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  )
}
