const styleStrip = (props: {
  stops: [[string, string], [string, string], ...Array<[string, string]>]
  direction?: string
}): string => {
  const { direction = 'to right', stops } = props

  const series = stops
    .map((stop, index) => {
      const [color] = stop
      if (index === 0) {
        return [color, stop.join(' ')]
      }
      const [, prevPosition] = stops[index - 1]
      return [`${color} ${prevPosition}`, stop.join(' ')]
    })
    .flat()
    .join(', ')

  return `repeating-linear-gradient(${direction}, ${series})`
}

export { styleStrip }
