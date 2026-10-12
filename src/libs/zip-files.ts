export type ConflictChoice = 'replace' | 'keep' | 'cancel'

// Compare bounded chunks so large files do not need to fit in memory.
export async function sameContent(a: Blob, b: Blob): Promise<boolean> {
  if (a.size !== b.size) return false
  const chunkSize = 1024 * 1024
  for (let offset = 0; offset < a.size; offset += chunkSize) {
    const [left, right] = await Promise.all([
      a.slice(offset, offset + chunkSize).arrayBuffer(),
      b.slice(offset, offset + chunkSize).arrayBuffer(),
    ])
    const x = new Uint8Array(left)
    const y = new Uint8Array(right)
    if (x.some((byte, i) => byte !== y[i])) return false
  }
  return true
}

export function availableName(name: string, names: Set<string>): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  let index = 1
  while (names.has(`${stem}(${index})${extension}`)) index++
  return `${stem}(${index})${extension}`
}

export async function mergeZipFiles(
  existing: File[],
  incoming: File[],
  choose: (
    oldFile: File,
    newFile: File,
    newName: string,
  ) => Promise<ConflictChoice>,
) {
  const files = [...existing]
  let duplicates = 0
  for (const file of incoming) {
    const index = files.findIndex((item) => item.name === file.name)
    if (index < 0) {
      files.push(file)
      continue
    }
    if (await sameContent(files[index], file)) {
      duplicates++
      continue
    }
    const newName = availableName(
      file.name,
      new Set(files.map((item) => item.name)),
    )
    const choice = await choose(files[index], file, newName)
    if (choice === 'replace') files[index] = file
    if (choice === 'keep') {
      files.push(
        new File([file], newName, {
          type: file.type,
          lastModified: file.lastModified,
        }),
      )
    }
  }
  return { files, duplicates }
}
