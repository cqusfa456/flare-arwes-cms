import { Animated, type AnimatedProp, cx } from '@arwes/react'

type TableProps = {
  className?: string
  animated?: AnimatedProp
  minWidth?: string
  children: React.ReactNode
}

const Table = (props: TableProps): JSX.Element => {
  const { className, animated, minWidth, children } = props
  return (
    <Animated
      role="table"
      className={cx('overflow-auto flex min-w-0 min-h-0 max-w-full', className)}
      animated={animated}
    >
      <div className="flex flex-col gap-1 w-full min-w-0 min-h-0" style={{ minWidth }}>
        {children}
      </div>
    </Animated>
  )
}

type RowProps = {
  className?: string
  children: React.ReactNode
}

const Row = (props: RowProps): JSX.Element => {
  const { className, children } = props
  return (
    <div role="row" className={cx('group flex flex-row gap-1 min-w-0 min-h-0', className)}>
      {children}
    </div>
  )
}

type CellProps = {
  className?: string
  isHeader?: boolean
  children: React.ReactNode
}

const Cell = (props: CellProps): JSX.Element => {
  const { className, isHeader, children } = props
  return (
    <div
      role="cell"
      className={cx(
        'flex flex-row gap-2 px-2 py-0.5 min-w-0 min-h-0',
        'transition-[opacity,transform,color,background] ease-out duration-200',
        isHeader
          ? 'border-b border-primary-main-7 text-primary-main-4 bg-primary-main-5/10'
          : 'bg-primary-main-9/10 group-hover:bg-primary-main-9/30',
        className
      )}
    >
      {children}
    </div>
  )
}

export type { TableProps, RowProps, CellProps }
export { Table, Row, Cell }
