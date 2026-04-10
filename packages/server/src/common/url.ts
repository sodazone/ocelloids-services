export function maskPassword(urlString: string): string {
  try {
    const url = new URL(urlString)

    if (url.password) {
      url.password = '****'
    }

    return url.toString()
  } catch {
    return urlString
  }
}
