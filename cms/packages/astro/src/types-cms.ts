/**
 * Internal type definitions for Flare CMS schemas.
 *
 * Inlined from `@flare-cms/core` so this package can build its own
 * declarations without depending on the core package's type graph
 * (which requires workspace resolution that fails in strict pnpm
 * installs). The shapes mirror `packages/core/src/types/collection-config.ts`.
 */

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'richtext'
  | 'markdown'
  | 'json'
  | 'array'
  | 'object'
  | 'reference'
  | 'media'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'textarea'
  | 'slug'
  | 'color'
  | 'file'
  | 'quill'
  | 'tinymce'
  | 'mdxeditor'

export interface BlockDefinition {
  label?: string
  description?: string
  properties: Record<string, FieldConfig>
}

export type BlockDefinitions = Record<string, BlockDefinition>

export interface FieldConfig {
  type: FieldType
  title?: string
  description?: string
  required?: boolean
  default?: any
  placeholder?: string
  helpText?: string

  // Validation
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string

  // Select/Radio/Multiselect options
  enum?: string[]
  enumLabels?: string[]

  // Reference field
  collection?: string | string[]

  // Array/Object fields
  items?: FieldConfig
  properties?: Record<string, FieldConfig>
  blocks?: BlockDefinitions
  discriminator?: string

  // UI hints
  format?: string
  widget?: string

  // Conditional display
  dependsOn?: string
  showWhen?: any
}

export interface CollectionSchema {
  type: 'object'
  properties: Record<string, FieldConfig>
  required?: string[]
}
