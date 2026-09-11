import React, { type ReactElement, type ReactNode, useEffect, useState } from 'react'

interface NoSSRProps {
  children: ReactNode
}

const NoSSR = (props: NoSSRProps): ReactElement => {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    setAvailable(true)
  }, [])

  return <>{available ? props.children : null}</>
}

export type { NoSSRProps }
export { NoSSR }
