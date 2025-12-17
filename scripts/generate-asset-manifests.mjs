import fs from 'node:fs/promises'
import path from 'node:path'

const assetsDir = path.join(process.cwd(), 'public', 'assets')

async function listFiles(ext) {
  const entries = await fs.readdir(assetsDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => name.toLowerCase().endsWith(ext))
    .sort((a, b) => a.localeCompare(b))
}

async function writeJson(filename, data) {
  const filePath = path.join(assetsDir, filename)
  const json = JSON.stringify(data, null, 2) + '\n'
  await fs.writeFile(filePath, json, 'utf8')
}

async function main() {
  const panos = [...(await listFiles('.png')), ...(await listFiles('.jpg'))].sort((a, b) => a.localeCompare(b))
  const videos = await listFiles('.mp4')

  await writeJson('panos.json', panos)
  await writeJson('videos.json', videos)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

