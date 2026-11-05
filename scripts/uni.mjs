import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const platform = args[args.indexOf('-p') + 1] || 'h5'
const mode = args.includes('build') ? 'build' : 'dev'
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'), ...args], {
  cwd: root,
  stdio: 'inherit',
  env: {...process.env, UNI_INPUT_DIR: root, UNI_OUTPUT_DIR: path.join(root, 'dist', mode, platform)}
})
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
