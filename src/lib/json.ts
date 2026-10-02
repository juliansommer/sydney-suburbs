// Reads JSON we serve ourselves: our API and our static data files. The
// shapes are trusted rather than checked at runtime; the tests pin them down.
export async function readJson<T>(res: Response): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-return
  return await res.json()
}
