/* eslint-disable */

const path = require('path')
const fs = require('fs')
const { globSync } = require('glob')

const generateTypes = () => {
  const arwesPackagesPath = path.join(__dirname, '../../../packages')
  const arwesPackages = fs
    .readdirSync(arwesPackagesPath)
    .filter((filePath) => fs.lstatSync(path.join(arwesPackagesPath, filePath)).isDirectory())
    .map((name) => ({
      name: `@arwes/${name}`,
      path: path.join(arwesPackagesPath, name),
      typesPath: path.join(arwesPackagesPath, name, 'build/esm')
    }))

  const externalPackages = [
    '@types/react',
    '@types/react-dom',
    '@types/prop-types',
    'motion',
    '@motionone/dom',
    '@motionone/types',
    'csstype',
    'empanada'
  ].map((name) => ({
    name,
    path: path.join(__dirname, '../../../node_modules', name),
    typesPath: path.join(__dirname, '../../../node_modules', name)
  }))

  const packages = [...arwesPackages, ...externalPackages]

  console.info(`[TYPEGEN] Gathering type definitions for ${packages.length} packages...`)

  const types = packages
    .map((pkg) =>
      globSync(path.join(pkg.typesPath, '**/*.d.ts'))
        .map((typePath) => typePath.replace(pkg.typesPath, ''))
        .map((typeFilePath) => ({
          filename: `file:///node_modules/${path.join(pkg.name, typeFilePath)}`,
          code: String(fs.readFileSync(path.join(pkg.typesPath, typeFilePath)))
        }))
    )
    .flat()
    .concat([
      {
        filename: `file:///node_modules/motion/index.d.ts`,
        code: "export * from './types/index.d.ts';"
      }
    ])

  console.info(`[TYPEGEN] Creating type definitions for ${types.length} file types...`)

  const typeDefinitionsPath = path.join(__dirname, '../src/playground/typeDefinitions.js')
  const typeDefinitionsContent = `export const typeDefinitions = ${JSON.stringify(types, null, 2)};`

  fs.writeFileSync(typeDefinitionsPath, typeDefinitionsContent)

  console.info(`[TYPEGEN] Type definitions successfully created at "${typeDefinitionsPath}".`)
}

module.exports = generateTypes
