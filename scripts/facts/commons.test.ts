import { describe, expect, it } from "vitest"

import { cleanArtist, isSuitableFile, toPhotoSource } from "./commons.ts"

type ImagePage = Parameters<typeof toPhotoSource>[1]

function imagePage(
  overrides: { mime?: string; licence?: string; nonFree?: string } = {},
): ImagePage {
  return {
    title: "File:Alpha.jpg",
    imageinfo: [
      {
        thumburl:
          "https://upload.wikimedia.org/alpha.jpg?utm_source=commons.wikimedia.org&width=1600",
        descriptionurl: "https://commons.wikimedia.org/wiki/File:Alpha.jpg",
        mime: overrides.mime ?? "image/jpeg",
        extmetadata: {
          Artist: { value: '<a href="/wiki/User:Jane">Jane Smith</a>' },
          LicenseShortName: { value: overrides.licence ?? "CC BY-SA 4.0" },
          LicenseUrl: {
            value: "https://creativecommons.org/licenses/by-sa/4.0",
          },
          NonFree: { value: overrides.nonFree ?? "false" },
        },
      },
    ],
  }
}

describe("isSuitableFile", () => {
  it("accepts ordinary photos", () => {
    expect(isSuitableFile("King Street Newtown.jpg")).toBeTruthy()
    expect(isSuitableFile("Seal_Rocks.jpg")).toBeTruthy()
    expect(isSuitableFile("Kingsgrove Mapleton.jpg")).toBeTruthy()
  })

  it("rejects SVGs", () => {
    expect(isSuitableFile("Newtown skyline.svg")).toBeFalsy()
  })

  it("rejects maps, flags and coats of arms", () => {
    expect(isSuitableFile("Location_map_of_Alpha.jpg")).toBeFalsy()
    expect(isSuitableFile("WheelerHeightsReservesMap.png")).toBeFalsy()
    expect(isSuitableFile("Flag of New South Wales.png")).toBeFalsy()
    expect(isSuitableFile("Coat_of_arms_of_Alpha.png")).toBeFalsy()
  })
})

describe("cleanArtist", () => {
  it("strips HTML and decodes entities", () => {
    expect(
      cleanArtist('<a href="x">J&nbsp;Bar</a> &amp; <span>Co&#x27;s</span>'),
    ).toBe("J Bar & Co's")
  })

  it("drops wiki signature talk links and timestamps", () => {
    expect(
      cleanArtist(
        'Sardaka (<a href="/wiki/User_talk:Sardaka">talk</a>) 08:15, 11 December 2014 (UTC)',
      ),
    ).toBe("Sardaka")
  })

  it("tidies spacing left by stripped tags", () => {
    expect(cleanArtist("Winston ( <a>Wyp</a> ) at English Wikipedia .")).toBe(
      "Winston (Wyp) at English Wikipedia.",
    )
  })
})

describe("toPhotoSource", () => {
  it("builds the credit for a freely licensed photo", () => {
    expect(toPhotoSource("Alpha.jpg", imagePage())).toStrictEqual({
      file: "Alpha.jpg",
      thumbUrl: "https://upload.wikimedia.org/alpha.jpg?width=1600",
      artist: "Jane Smith",
      licence: "CC BY-SA 4.0",
      licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Alpha.jpg",
    })
  })

  it("rejects non-free images", () => {
    expect(
      toPhotoSource("Alpha.jpg", imagePage({ nonFree: "true" })),
    ).toBeNull()
  })

  it("rejects images without a licence", () => {
    expect(toPhotoSource("Alpha.jpg", imagePage({ licence: "" }))).toBeNull()
  })

  it("rejects SVGs", () => {
    expect(
      toPhotoSource("Alpha.svg", imagePage({ mime: "image/svg+xml" })),
    ).toBeNull()
  })
})
